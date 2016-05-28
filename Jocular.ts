import http = require('http');
import url = require('url');



export namespace Jocular {



  /////////////////////////////////////////////////////////////////////////////
  // Unit
  /////////////////////////////////////////////////////////////////////////////

  export class Unit { }



  /////////////////////////////////////////////////////////////////////////////
  // Either
  /////////////////////////////////////////////////////////////////////////////

  enum EitherTag {
    Left,
    Right
  }

  export class Either<A, B> {

    private static _Key: number = Math.random();

    private _Tag: EitherTag;

    private _Term: any;

    public constructor(key: number, tag: EitherTag, term: any) {
      if (key != Either._Key) {
        throw "not allowed to call this constructor";
      }
      this._Tag = tag;
      this._Term = term;
    }

    public Cases<C>(caseLeft: (a: A) => C, caseRight: (a: B) => C): C {
      switch (this._Tag) {
        case EitherTag.Left:
          return caseLeft(this._Term);
        case EitherTag.Right:
          return caseRight(this._Term);
        default:
          throw "missing case";
      }
    }

    public static Left<A, B>(x: A): Either<A, B> {
      return new Either(Either._Key, EitherTag.Left, x);
    }

    public static Right<A, B>(x: B): Either<A, B> {
      return new Either(Either._Key, EitherTag.Right, x);
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // Service
  /////////////////////////////////////////////////////////////////////////////

  export class Service<TState, TError, A> {

    private _Step: (a: TState) => Either<TError, [TState, A]>;

    public constructor(step: (a: TState) => Either<TError, [TState, A]>) {
      this._Step = step;
    }

    public Bind<B>(
      f: (a: A) => Service<TState, TError, B>
    ): Service<TState, TError, B> {
      return new Service(
        (s1: TState) =>
          this._Step(s1).Cases(Either.Left, ([s2, a]) => f(a)._Step(s2))
      );
    }

    public Recover(
      f: (e: TError) => Service<TState, TError, A>
    ): Service<TState, TError, A> {
      return new Service(
        (s1: TState) =>
          this._Step(s1).Cases(error => f(error)._Step(s1), Either.Right)
      );
    }

    public MapError<TError2>(
      f: (e: TError) => TError2
    ): Service<TState, TError2, A> {
      return new Service(
        (s1: TState) =>
          this._Step(s1).Cases(error => Either.Left(f(error)), Either.Right)
      );
    }

    public Map<B>(f: (a: A) => B): Service<TState, TError, B> {
      return this.Bind(a => Service.Return(f(a)));
    }

    public ReadState(): Service<TState, TError, TState> {
      return this.Bind(_ => Service.ReadState());
    }

    public WriteState(x: TState): Service<TState, TError, A> {
      return this.Bind(a => Service.WriteState(x)
        .Bind(_ => Service.Return(a)));
    }

    public static Return<TState, TError, A>(x: A): Service<TState, TError, A> {
      return new Service(s => Either.Right([s, x]));
    }

    public static Error<TState, TError, A>(
      error: TError
    ): Service<TState, TError, A> {
      return new Service(s => Either.Left(error));
    }

    public static ReadState<TState, TError>(
    ): Service<TState, TError, TState> {
      return new Service(s => Either.Right([s, s]));
    }

    public static WriteState<TState, TError, Unit>(
      x: TState
    ): Service<TState, TError, Unit> {
      return new Service(_ => Either.Right([x, new Unit()]));
    }

    public static Output<TState>(
      res: http.ServerResponse,
      service: Service<TState, HttpError, HttpResponse>,
      state: TState
    ): void {
      service._Step(state).Cases(
        error => {
          res.statusCode = error.Status;
          res.setHeader("Content-Type", "text/plain");
          res.end(`[${error.Code}] ${error.Message}`);
        },
        ([_, r]) => {
          res.statusCode = r.Status;
          res.end(r.Body);
        }
      );
    }

  }

  // No polymorphic HKTs in TypeScript, so we have to specialise to Service.
  export function Kleisli<TState, TError, A, B, C>(
    g: (b: B) => Service<TState, TError, C>,
    f: (a: A) => Service<TState, TError, B>
  ): (a: A) => Service<TState, TError, C> {
    return (a: A) => f(a).Bind(g);
  }



  /////////////////////////////////////////////////////////////////////////////
  // HttpError
  /////////////////////////////////////////////////////////////////////////////

  export class HttpError {

    private _Status: number;

    private _Code: number;

    private _Message: string;

    private _Cause: any;

    public get Status(): number {
      return this._Status;
    }

    public get Code(): number {
      return this._Code;
    }

    public get Message(): string {
      return this._Message;
    }

    constructor(status: number, code: number, message: string) {
      this._Status = status;
      this._Code = code;
      this._Message = message;
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // HttpRequest
  /////////////////////////////////////////////////////////////////////////////

  export type Query = { [key: string]: string };

  export class HttpRequest {

    private _Path: string;

    private _Query: Query

    public get Path(): string {
      return this._Path;
    }

    public get Query(): Query {
      return this._Query;
    }

    constructor(path: string, query: Query) {
      this._Path = path;
      this._Query = query;
    }

    public static Input(req: http.ServerRequest): HttpRequest {
      let { pathname, query } = url.parse(req.url, true);
      return new HttpRequest(pathname, query);
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // HttpResponse
  /////////////////////////////////////////////////////////////////////////////

  export class HttpResponse {

    private _Status: number;

    private _Body: string;

    public get Status(): number {
      return this._Status;
    }

    public get Body(): string {
      return this._Body;
    }

    constructor(status: number, body: string) {
      this._Status = status;
      this._Body = body;
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // Routing
  /////////////////////////////////////////////////////////////////////////////

  export type RouteTable<TState> = [string, Controller<TState>][];

  export type Controller<TState> =
    (req: HttpRequest) => Service<TState, HttpError, HttpResponse>;

  export function Route<TState>(
    table: RouteTable<TState>,
    req: HttpRequest
  ): Service<TState, HttpError, HttpResponse> {
    for (let row of table) {
      if (row[0] == req.Path) {
        return row[1](req);
      }
    }
    return Service.Return(new HttpResponse(404, ""));
  }



  /////////////////////////////////////////////////////////////////////////////
  // Maybe
  /////////////////////////////////////////////////////////////////////////////

  enum MaybeTag {
    Nothing,
    Just
  }

  export class Maybe<A> {

    private static _Key: Number = Math.random();

    private _Tag: MaybeTag;

    private _Value: A;

    public constructor(key: Number, tag: MaybeTag, value: A) {
      if (key !== Maybe._Key) {
        throw "cannot call this constructor";
      }
      this._Tag = tag;
      this._Value = value;
    }

    public Cases<C>(
      caseNothing: () => C,
      caseJust: (x: A) => C
    ) {
      switch (this._Tag) {
        case MaybeTag.Just:
          return caseJust(this._Value);
        case MaybeTag.Nothing:
          return caseNothing();
        default:
          throw "missing case";
      }
    }

    public static Nothing<A>(): Maybe<A> {
      return new Maybe(Maybe._Key, MaybeTag.Nothing, undefined);
    }

    public static Just<A>(x: A): Maybe<A> {
      return new Maybe(Maybe._Key, MaybeTag.Just, x);
    }

  }
  
}
