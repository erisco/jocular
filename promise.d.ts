declare class Symbol {
}

declare namespace Symbol {
  const iterator: symbol;
}

interface Generator<A> {
  next(): { value: A, done: boolean }
}

interface Iterable<A> {
  [Symbol.iterator]: () => Generator<A>;
}

declare class Promise<TError, A> {

  constructor(
    f: (resolve: (a: A) => void, reject: (a: TError) => void) => void
  );

  public then<TError2, B>(
    f: (a: A) => Promise<TError2, B>
  ): Promise<TError | TError2, B>;

  public then<TError2, TError3, B>(
    f: (a: A) => Promise<TError2, B>,
    g: (a: TError) => Promise<TError3, B>
  ): Promise<TError | TError2 | TError3, B>;

  public then<TError2, B>(f: (a: A) => B): Promise<TError | TError2, B>;

  public then<TError2, TError3, B>(
    f: (a: A) => B,
    g: (a: TError) => TError3
  ): Promise<TError | TError2 | TError3, B>;

  public catch<TError2, B>(
    f: (a: TError) => Promise<TError2, B>
  ): Promise<TError2, B>;

  public catch<TError2, B>(f: (a: TError) => B): Promise<TError2, B>;

  public static all<TError, A>(
    iterable: Iterable<Promise<TError, A>>
  ): Promise<TError, Iterable<A>>;
  
  public static all<TError, A>(
    iterable: Promise<TError, A>[]
  ): Promise<TError, Iterable<A>>;

  public static resolve<TError, A>(x: A): Promise<TError, A>;

  public static reject<TError, A>(x: TError): Promise<TError, A>;

}
