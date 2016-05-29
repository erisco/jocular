import http = require('http');
import url = require('url');
import { jocular } from './Jocular';

import Service = jocular.Service;
import HttpRequest = jocular.HttpRequest;
import HttpResponse = jocular.HttpResponse;
import Maybe = jocular.Maybe;
import nothing = jocular.nothing;
import just = jocular.just;
import route = jocular.route;
import RouteTable = jocular.RouteTable;
import kleisli = jocular.kleisli;
import getRequest = jocular.getRequest;



///////////////////////////////////////////////////////////////////////////////
// Node.js server
///////////////////////////////////////////////////////////////////////////////

var port = process.env.port || 1337
http.createServer((req: http.ServerRequest, res: http.ServerResponse) => {
  Service.output(
    res,
    route(myRouteTable, HttpRequest.input(req)),
    new Environment(nothing<User>())
  );
}).listen(port);



///////////////////////////////////////////////////////////////////////////////
// Routes
///////////////////////////////////////////////////////////////////////////////

const myRouteTable: RouteTable<Environment> = [
  ["/index.html", indexPage],
  ["/secret.html", kleisli(secretPage, auth)]
];



///////////////////////////////////////////////////////////////////////////////
// Index controller
///////////////////////////////////////////////////////////////////////////////

function indexPage(
  req: HttpRequest
): Service<Environment, HttpResponse, HttpResponse> {
  return Service.return(new HttpResponse(200, "Hello world!"));
}



///////////////////////////////////////////////////////////////////////////////
// Auth policy
///////////////////////////////////////////////////////////////////////////////

function auth(
  req: HttpRequest
): Service<Environment, HttpResponse, HttpRequest> {
  let { email, password } = req.query;
  if (password === "test") {
    return Service.writeState(
      new Environment(just(new User(email)))
    ).map(_ => req);
  }
  else {
    return Service.error(new HttpResponse(401, "Unauthorized"));
  }
}



///////////////////////////////////////////////////////////////////////////////
// Secret controller
///////////////////////////////////////////////////////////////////////////////

function secretPage(
  req: HttpRequest
): Service<Environment, HttpResponse, HttpResponse> {
  return Service.readState<Environment, HttpResponse>()
    .bind(s => s.AuthUser)
    .bind(user =>
      Service.promise(
        getRequest("http://www.example.com")
        .then(txt =>
          new HttpResponse(
            200,
            `Hello ${user.email}, you found the secret!\n\n${txt}`
          )
        )
      )
    );
}



///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////

class Environment {

  // Database handle, configuration, etc

  private _authUser: Maybe<User>;

  public get AuthUser(): Service<Environment, HttpResponse, User> {
    return this._authUser.cases(
      () => Service.error(new HttpResponse(401, "Unauthorized")),
      u => Service.return(u)
    );
  }

  public constructor(authUser: Maybe<User>) {
    this._authUser = authUser;
  }

}



///////////////////////////////////////////////////////////////////////////////
// User
///////////////////////////////////////////////////////////////////////////////

class User {

  private _email: string;

  public get email(): string {
    return this._email;
  }

  public constructor(email: string) {
    this._email = email;
  }

}


