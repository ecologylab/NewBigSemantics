// The web server

/// <reference path="../typings/main.d.ts" />
/// <reference path="./xml.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as xml from 'xml';
import DownloaderPool from './dpool';

function toTaskProto(query: any): any {
  return {
    url: query.url,
    userAgent: query.agent,
    maxAttempts: Number(query.attempts),
    msPerAttempts: Number(query.timeout),
  };
}

DownloaderPool.create((err, dpool) => {
  if (err) { return console.error(err); }

  dpool.start();

  var app = express();

  app.get('/download', (req, resp) => {
    if (!req.query.url || req.query.url === '') {
      resp.status(400);
      resp.end("Parameter 'url' is required.");
      return;
    }

    dpool.newTask(toTaskProto(req.query), (err, task) => {
      if (err) {
        resp.status(500);
      }
      if (task.response) {
        if (task.response.raw) {
          task.response.content = task.response.raw.toString();
          delete task.response.raw;
        }
      }
      resp.json(task);
      resp.end();
    });
  });

  app.get('/proxy', (req, resp) => {
    if (!req.query.url || req.query.url === '') {
      resp.status(400);
      resp.end("Parameter 'url' is required.");
      return;
    }

    dpool.newTask(toTaskProto(req.query), (err, task) => {
      if (task && task.response) {
        resp.status(task.response.code);
        task.response.headers.forEach(hdr => {
          resp.set(hdr.name, hdr.value);
        });
        resp.end(task.response.raw);
      } else {
        resp.status(500);
        resp.send(task);
        resp.end();
      }
    });
  });

  app.get('/DownloaderPool/echo/get', (req, resp) => {
    var msg = req.query.msg;
    resp.send('Echo Message: ' + msg);
    resp.end();
  });

  app.get('/DownloaderPool/page/download.json', (req, resp) => {
    if (!req.query.url || req.query.url === '') {
      resp.status(400);
      resp.end("Parameter 'url' is required.");
      return;
    }

    dpool.newTask(toTaskProto(req.query), (err, task) => {
      if (err) {
        resp.status(500);
        resp.json(task);
        resp.end();
        return;
      }

      // generate JSON response
      if (task.response.raw) {
        task.response.content = task.response.raw.toString();
        delete task.response.raw;
      }
      resp.type('json');
      resp.send({
        download_task: {
          id: task.id,
          state: task.state === 'finished' ? 'SUCCEEDED' : 'TERMINATED',
          user_agent: task.userAgent,
          max_attempts: task.maxAttempts,
          attempt_time: task.msPerAttempt,

          url: req.query.url,

          response: {
            url: task.response.url,
            code: task.response.code,
            other_urls: (!task.response.otherUrls) ? [] : task.response.otherUrls.map(otherUrl => {
              return {
                other_url: otherUrl,
              };
            }),
            headers: (!task.response.headers) ? [] : task.response.headers.map(hdr => {
              return {
                name: hdr.name,
                value: hdr.value,
              };
            }),
            content: task.response.content,
          }, // response

          // we have to skip logs for now, to not break JSON deserializer in
          // Java.
          /*
          logs: (!task.logs) ? [] : task.logs.map(log => {
            return {
              datetime: log.datetime,
              name: log.name,
              args: JSON.stringify(log.args),
            };
          }),
          */
        }, // download_task
      }); // resp.send()
    }); // dpool.newTask() callback
  }); // app.get() callback

  app.get('/DownloaderPool/page/download.xml', (req, resp) => {
    if (!req.query.url || req.query.url === '') {
      resp.status(400);
      resp.end("Parameter 'url' is required.");
      return;
    }

    dpool.newTask(toTaskProto(req.query), (err, task) => {
      if (err) {
        resp.status(500);
        resp.json(task);
        resp.end();
        return;
      }

      // generate XML response
      if (task.response.raw) {
        task.response.content = task.response.raw.toString();
        delete task.response.raw;
      }
      resp.type('xml');
      resp.send(xml({
        download_task: [
          {
            _attr: {
              id: task.id,
              state: task.state === 'finished' ? 'SUCCEEDED' : 'TERMINATED',
              user_agent: task.userAgent,
              max_attempts: task.maxAttempts,
              attempt_time: task.msPerAttempt,
            },
          },
          {
            url: req.query.url
          },
          {
            response: [
              {
                _attr: {
                  url: task.response.url,
                  code: task.response.code,
                },
              },
              (!task.response.otherUrls) ? {} : {
                other_urls: task.response.otherUrls.map(otherUrl => {
                  return {
                    other_url: otherUrl,
                  };
                }),
              },
              (!task.response.headers) ? {} : {
                headers: task.response.headers.map(hdr => {
                  return {
                    header: {
                      _attr: {
                        name: hdr.name,
                        value: hdr.value,
                      },
                    },
                  };
                }),
              },
              {
                content: task.response.content,
              }
            ],
          },
          (!task.logs) ? {} : {
            logs: task.logs.map(log => {
              return {
                log: [
                  { datetime: log.datetime },
                  { name: log.name },
                  { args: JSON.stringify(log.args) },
                ],
              };
            }),
          },
        ],
      }));
      resp.end();
    });
  });

  var server = app.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Web server listening at http://%s:%s", host, port);
  });

});

