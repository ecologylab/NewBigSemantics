// Test parseHttpResp().

/// <reference types="jasmine" />

import parseHttpResp from '../httpRespParser';

describe("http response parser", () => {
  it("can parse without redirection", done => {
    var url = 'https://www.google.com';
    var content = [
      "HTTP/1.1 200 OK",
      "Date: Thu, 30 Jun 2016 05:03:04 GMT",
      "Expires: -1",
      "Cache-Control: private, max-age=0",
      "Content-Type: text/html; charset=ISO-8859-1",
      "P3P: CP=\"This is not a P3P policy! See https://www.google.com/support/accounts/answer/151657?hl=en for more info.\"",
      "Server: gws",
      "X-XSS-Protection: 1; mode=block",
      "X-Frame-Options: SAMEORIGIN",
      "Set-Cookie: NID=81=MyZisO2MzC0C1d_v3lhppK2ol53R-fMq07-EJ8AGzPUbAD0X2NNPD49N79nh3XkBV4DKS0VgJuoS9vEe4GdEVTy5PPk8aIWBGgKHwDv25-ZuoXf2D2o_D54G7OdAA23xa5Ws2eCK2jjoWnI; expires=Fri, 30-Dec-2016 05:03:04 GMT; path=/; domain=.google.com; HttpOnly",
      "Alternate-Protocol: 443:quic",
      "Alt-Svc: quic=\":443\"; ma=2592000; v=\"34,33,32,31,30,29,28,27,26,25\"",
      "Accept-Ranges: none",
      "Vary: Accept-Encoding",
      "",
      "google homepage",
    ].join('\r\n');
    var raw = new Buffer(content);
    var result = parseHttpResp(url, raw);
    expect(result.code).toBe(200);
    expect(result.headers.length).toBe(13);
    expect(result.headers[3].value).toBe("text/html; charset=ISO-8859-1");
    expect(result.raw.toString()).toBe("google homepage");
    done();
  });

  it("can parse with redirection without content", done => {
    var url = 'https://www.google.com';
    var content = [
      "HTTP/1.1 301 Moved Permanently",
      "Location: http://www.google.com/",
      "Content-Type: text/html; charset=UTF-8",
      "Date: Thu, 30 Jun 2016 05:23:48 GMT",
      "Expires: Sat, 30 Jul 2016 05:23:48 GMT",
      "Cache-Control: public, max-age=2592000",
      "Server: gws",
      "Content-Length: 219",
      "X-XSS-Protection: 1; mode=block",
      "X-Frame-Options: SAMEORIGIN",
      "",
      "HTTP/1.1 200 OK",
      "Date: Thu, 30 Jun 2016 05:03:04 GMT",
      "Expires: -1",
      "Cache-Control: private, max-age=0",
      "Content-Type: text/html; charset=ISO-8859-1",
      "P3P: CP=\"This is not a P3P policy! See https://www.google.com/support/accounts/answer/151657?hl=en for more info.\"",
      "Server: gws",
      "X-XSS-Protection: 1; mode=block",
      "X-Frame-Options: SAMEORIGIN",
      "Set-Cookie: NID=81=MyZisO2MzC0C1d_v3lhppK2ol53R-fMq07-EJ8AGzPUbAD0X2NNPD49N79nh3XkBV4DKS0VgJuoS9vEe4GdEVTy5PPk8aIWBGgKHwDv25-ZuoXf2D2o_D54G7OdAA23xa5Ws2eCK2jjoWnI; expires=Fri, 30-Dec-2016 05:03:04 GMT; path=/; domain=.google.com; HttpOnly",
      "Alternate-Protocol: 443:quic",
      "Alt-Svc: quic=\":443\"; ma=2592000; v=\"34,33,32,31,30,29,28,27,26,25\"",
      "Accept-Ranges: none",
      "Vary: Accept-Encoding",
      "",
      "google homepage",
    ].join('\r\n');
    var raw = new Buffer(content);
    var result = parseHttpResp(url, raw);
    expect(result.code).toBe(200);
    expect(result.headers.length).toBe(13);
    expect(result.headers[3].value).toBe("text/html; charset=ISO-8859-1");
    expect(result.raw.toString()).toBe("google homepage");
    done();
  });
});
