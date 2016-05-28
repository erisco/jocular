import http = require('http');
import url = require('url');
import { Jocular } from './Jocular';

import Service = Jocular.Service;
import HttpRequest = Jocular.HttpRequest;
import HttpResponse = Jocular.HttpResponse;
import Maybe = Jocular.Maybe;
import Route = Jocular.Route;
import RouteTable = Jocular.RouteTable;
import Kleisli = Jocular.Kleisli;
import HttpError = Jocular.HttpError;



///////////////////////////////////////////////////////////////////////////////
// Node.js server
///////////////////////////////////////////////////////////////////////////////

var port = process.env.port || 1337
http.createServer((req, res) => {
  Service.Output(
    res,
    Route(MyRouteTable, HttpRequest.Input(req)),
    new Environment(Maybe.Nothing<User>())
  );
}).listen(port);



///////////////////////////////////////////////////////////////////////////////
// Routes
///////////////////////////////////////////////////////////////////////////////

const MyRouteTable: RouteTable<Environment> = [
  ["/index.html", IndexPage],
  ["/secret.html", Kleisli(SecretPage, Auth)]
];



///////////////////////////////////////////////////////////////////////////////
// Index controller
///////////////////////////////////////////////////////////////////////////////

function IndexPage(
  req: HttpRequest
): Service<Environment, HttpError, HttpResponse> {
  return Service.Return(new HttpResponse(200, "Hello world!"));
}



///////////////////////////////////////////////////////////////////////////////
// Auth policy
///////////////////////////////////////////////////////////////////////////////

function Auth(
  req: HttpRequest
): Service<Environment, HttpError, HttpRequest> {
  let { email, password } = req.Query;
  if (password === "test") {
    return Service.WriteState(
      new Environment(Maybe.Just(new User(email)))
    ).Map(_ => req);
  }
  else {
    return Service.Error(new HttpError(401, 0, "Unauthorized"));
  }
}



///////////////////////////////////////////////////////////////////////////////
// Secret controller
///////////////////////////////////////////////////////////////////////////////

function SecretPage(
  req: HttpRequest
): Service<Environment, HttpError, HttpResponse> {
  return Service.ReadState<Environment, HttpError>()
    .Bind(s => s.AuthUser)
    .Map(user =>
      new HttpResponse(200, `Hello ${user.Email}, you found the secret!`)
    );
}



///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////

class Environment {

  // Database handle, configuration, etc

  private _AuthUser: Maybe<User>;

  public get AuthUser(): Service<Environment, HttpError, User> {
    return this._AuthUser.Cases(
      () => Service.Error(new HttpError(401, 0, "Unauthorized")),
      u => Service.Return(u)
    );
  }

  public constructor(authUser: Maybe<User>) {
    this._AuthUser = authUser;
  }

}



///////////////////////////////////////////////////////////////////////////////
// User
///////////////////////////////////////////////////////////////////////////////

class User {

  private _Email: string;

  public get Email(): string {
    return this._Email;
  }

  public constructor(email: string) {
    this._Email = email;
  }

}


