import http = require('http');
import url = require('url');



export namespace jocular {



  /////////////////////////////////////////////////////////////////////////////
  // Unit
  /////////////////////////////////////////////////////////////////////////////

  export class Unit { }



  /////////////////////////////////////////////////////////////////////////////
  // Service
  /////////////////////////////////////////////////////////////////////////////

  export class Service<TState, TError, A> {

    private _step: (a: TState) => Promise<TError, [TState, A]>;

    public constructor(step: (a: TState) => Promise<TError, [TState, A]>) {
      this._step = step;
    }

    public bind<B>(
      f: (a: A) => Service<TState, TError, B>
    ): Service<TState, TError, B> {
      return new Service(
        (s1: TState) =>
          this._step(s1).then(([s2, a]) => f(a)._step(s2))
      );
    }
    
    public recover(
      f: (e: TError) => Service<TState, TError, A>
    ): Service<TState, TError, A> {
      return new Service(
        (s1: TState) =>
          this._step(s1).catch(error => f(error)._step(s1))
      );
    }

    public mapError<TError2>(
      f: (e: TError) => TError2
    ): Service<TState, TError2, A> {
      return new Service(
        (s1: TState) =>
          this._step(s1).catch(error => Promise.reject(f(error)))
      );
    }

    public map<B>(f: (a: A) => B): Service<TState, TError, B> {
      return this.bind(a => Service.return(f(a)));
    }

    public readState(): Service<TState, TError, TState> {
      return this.bind(_ => Service.readState());
    }

    public writeState(x: TState): Service<TState, TError, A> {
      return this.bind(a => Service.writeState(x)
        .bind(_ => Service.return(a)));
    }

    public static return<TState, TError, A>(x: A): Service<TState, TError, A> {
      return new Service(s => Promise.resolve([s, x]));
    }

    public static promise<TState, TError, A>(
      x: Promise<TError, A>
    ): Service<TState, TError, A> {
      return new Service(s => x.then(a => [s, a]));
    }

    public static error<TState, TError, A>(
      error: TError
    ): Service<TState, TError, A> {
      return new Service(s => Promise.reject(error));
    }

    public static readState<TState, TError>(
    ): Service<TState, TError, TState> {
      return new Service(s => Promise.resolve([s, s]));
    }

    public static writeState<TState, TError, Unit>(
      x: TState
    ): Service<TState, TError, Unit> {
      return new Service(_ => Promise.resolve([x, new Unit()]));
    }

    public static output<TState>(
      res: http.ServerResponse,
      service: Service<TState, HttpResponse, HttpResponse>,
      state: TState
    ): void {
      service._step(state).then(
        ([_, r]) => {
          res.statusCode = r.status;
          res.end(r.body);
        },
        r => {
          res.statusCode = r.status;
          res.end(r.body);
        }
      );
    }

  }

  // No polymorphic HKTs in TypeScript, so we have to specialise to Service.
  export function kleisli<TState, TError, A, B, C>(
    g: (b: B) => Service<TState, TError, C>,
    f: (a: A) => Service<TState, TError, B>
  ): (a: A) => Service<TState, TError, C> {
    return (a: A) => f(a).bind(g);
  }



  /////////////////////////////////////////////////////////////////////////////
  // HttpRequest
  /////////////////////////////////////////////////////////////////////////////

  export type Query = { [key: string]: string };

  export class HttpRequest {

    private _path: string;

    private _query: Query

    public get path(): string {
      return this._path;
    }

    public get query(): Query {
      return this._query;
    }

    constructor(path: string, query: Query) {
      this._path = path;
      this._query = query;
    }

    public static input(req: http.ServerRequest): HttpRequest {
      let { pathname, query } = url.parse(req.url, true);
      return new HttpRequest(pathname, query);
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // HttpResponse
  /////////////////////////////////////////////////////////////////////////////

  export class HttpResponse {

    private _status: number;

    private _body: string;

    public get status(): number {
      return this._status;
    }

    public get body(): string {
      return this._body;
    }

    constructor(status: number, body: string) {
      this._status = status;
      this._body = body;
    }

  }



  /////////////////////////////////////////////////////////////////////////////
  // Routing
  /////////////////////////////////////////////////////////////////////////////

  export type RouteTable<TState> = [string, Controller<TState>][];

  export type Controller<TState> =
    (req: HttpRequest) => Service<TState, HttpResponse, HttpResponse>;

  export function route<TState>(
    table: RouteTable<TState>,
    req: HttpRequest
  ): Service<TState, HttpResponse, HttpResponse> {
    for (let row of table) {
      if (row[0] == req.path) {
        return row[1](req);
      }
    }
    return Service.return(new HttpResponse(404, ""));
  }



  /////////////////////////////////////////////////////////////////////////////
  // HTTP reqests
  /////////////////////////////////////////////////////////////////////////////

  export function getRequest(
    url: string
  ): Promise<{ message: string }, string> {
    let content = "";
    return new Promise(
      (resolve, reject) =>
        http.get(
          url,
          resp =>
            resp.on('data', (chunk: Buffer) => content += chunk)
              .on('end', () => resolve(content))
        )
          .on('error', reject)
    );
  }



  /////////////////////////////////////////////////////////////////////////////
  // Maybe
  /////////////////////////////////////////////////////////////////////////////

  export interface Maybe<A> {
    cases<B>(caseNothing: () => B, caseJust: (x: A) => B): B;
  }

  export function nothing<A>(): Maybe<A> {
    return new MaybeImpl(MaybeTag.Nothing, undefined);
  }

  export function just<A>(x: A): Maybe<A> {
    return new MaybeImpl(MaybeTag.Just, x);
  }

  enum MaybeTag {
    Nothing,
    Just
  }

  class MaybeImpl<A> implements Maybe<A> {

    private _tag: MaybeTag;

    private _value: A;

    public constructor(tag: MaybeTag, value: A) {
      this._tag = tag;
      this._value = value;
    }

    public cases<C>(
      caseNothing: () => C,
      caseJust: (x: A) => C
    ): C {
      switch (this._tag) {
        case MaybeTag.Just:
          return caseJust(this._value);
        case MaybeTag.Nothing:
          return caseNothing();
        default:
          throw "missing case";
      }
    }
    
  }



  /////////////////////////////////////////////////////////////////////////////
  // Either
  /////////////////////////////////////////////////////////////////////////////

  export interface Either<A, B> {
    cases<C>(caseLeft: (a: A) => C, caseRight: (a: B) => C): C
  }

  export function left<A, B>(x: A): Either<A, B> {
    return new EitherImpl(EitherTag.Left, x);
  }

  export function right<A, B>(x: B): Either<A, B> {
    return new EitherImpl(EitherTag.Right, x);
  }

  enum EitherTag {
    Left,
    Right
  }

  export class EitherImpl<A, B> implements Either<A, B> {

    private _tag: EitherTag;

    private _term: any;

    public constructor(tag: EitherTag, term: any) {
      this._tag = tag;
      this._term = term;
    }

    public cases<C>(caseLeft: (a: A) => C, caseRight: (a: B) => C): C {
      switch (this._tag) {
        case EitherTag.Left:
          return caseLeft(this._term);
        case EitherTag.Right:
          return caseRight(this._term);
        default:
          throw "missing case";
      }
    }
    
  }
  
}
