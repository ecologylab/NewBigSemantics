
interface Task {
  id: string;
  name: string;
  hostname: string;
  pid: number;
  level: number;
  url: string;
  state: string;

  logs: any[];
  reqIp: string;
  reqId: string;
  dpoolTasks?: any[]; 
  msg: string;
  time: string;

  appId?: string;
  userId?: string;
  sessionId?: string;
  stack?: string;
}

function showDetails(taskId: string) {
  $.get("bsTask.json?id=" + taskId, log => {
    ReactDOM.render(
      <TaskView log={log} />,
      document.getElementById("taskInfo")
    );

    ($(".ui.accordion") as any).accordion({
      // After accordion opens, modal needs to be refreshed
      // otherwise scrolling may be impossible
      onChange: function() {
        ($("#taskModal") as any).modal("refresh");
      }
    });

    ($("#taskModal") as any).modal("show");
  });
}

interface TaskProps {
  log: { 
    err?: { stack: string; };
    task: Task;
    time: Date;
    msg: string;
    level: number; 
    hostname: string;
    pid: number;
  };
}

class TaskRow extends React.Component<TaskProps, {}> {
  render() {
    let id = "";
    let errorLevel = 0;

    if(this.props.log.task) {
      id = this.props.log.task.id;
      errorLevel = this.props.log.level; 
    }

    var idContent = id ? (<a onClick={() => showDetails(id)}>{id}</a>) : "";

    var cls = "positive";
    if(errorLevel == 50 || errorLevel == 60)
      cls = "error";
    else if(errorLevel == 40)
      cls = "warning";

    return (
      <tr className={cls}>
        <td><TimeAgo datetime={new Date(this.props.log.time)} /></td>
        <td className="selectable">
          {idContent}
        </td>
        <td>
          {this.props.log.msg}
        </td>
      </tr>
    );
  }
}

interface TasksState {
  page: number;
  logs: any[];
}

class TasksList extends React.Component<{}, TasksState> {
  constructor(props) {
    super(props);

    this.state = {
      page: 0,
      logs: []
    };

    this.updateTasks();
    setInterval(() => {
      this.updateTasks();
    }, 5000);
  }

  updateTasks() {
    $.getJSON("bsTasks.json?page=" + this.state.page, resp => {
      resp.logs.reverse();

      if(this.state.logs.length > 0) {
        let respLog = resp.logs[0];
        let respId = respLog.task && respLog.task.id;

        let curLog = this.state.logs[0];
        let curId = curLog.task && curLog.task.id;

        // don't bother updating if we have the same content
        if(respId == curId)
          return;
      }

      this.setState({
        page: this.state.page,
        logs: resp.logs
      });

      $("#numTasks").html(resp.numTasks);
      $("#numSuccesses").html(resp.successes);
      $("#numWarnings").html(resp.warnings);
      $("#numFailures").html(resp.failures);
    });
  }

  render() {
    let rows = [];

    for(let log of this.state.logs) {
      rows.push(<TaskRow log={log} />);
    }

    return (
      <table className="ui celled selectable table">
        <thead>
          <tr>
            <th className="three wide">Timestamp</th>
            <th className="three wide">ID</th>
            <th className="ten wide">Message</th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>
    );
  }
}

class TaskView extends React.Component<TaskProps, {}> {
  constructor(props) {
    super(props);
  }

  render() {
    let log = this.props.log;

    let logs = [];
    for(let logItem of log.task.logs) {
      logs.push(
        <tr>
          <td><span>{getFormattedDate(new Date(logItem.datetime))}</span></td>
          <td>{logItem.name}</td>
          <td>{!(logItem.args && logItem.args.stack) ? logItem.args : ""}</td>
        </tr>
      );
    }

    return (
      <div id="taskModal" className="ui long modal">
        <div className="header">{log.task.msg}</div>
        <div className="content">
          <table className="ui celled striped table">
          <tbody>
            <tr>
              <td><b>ID</b></td>
              <td>{log.task.id}</td>
            </tr>
            <tr>
              <td><b>URL</b></td>
              <td>{log.task.url}</td>
            </tr>
            <tr>
              <td><b>Hostname</b></td>
              <td>{log.hostname}</td>
            </tr>
            <tr>
              <td><b>PID</b></td>
              <td>{log.pid}</td>
            </tr>
            <tr>
              <td><b>Timestamp</b></td>
              <td><span>{getFormattedDate(new Date(log.time))}</span></td>
            </tr>
          </tbody>
        </table>

        <div className="ui header">Task Logs</div>
          <table className="ui celled striped table">
            <thead>
              <tr>
                <th width="20%">Timestamp</th>
                <th>Message</th>
                <th>Arguments</th>
              </tr>
            </thead>
            <tbody>
              {logs}
            </tbody>
          </table>

          <div className="ui header">Request Information</div>
          <table className="ui celled striped table">
            <tbody>
              <tr><td><b>IP</b></td><td>{log.task.reqIp}</td></tr>
              { log.task.reqId ? <tr><td><b>Request ID</b></td><td>{log.task.reqId}</td></tr> : ""}
              { log.task.appId ? <tr><td><b>Application ID</b></td><td>{log.task.appId}</td></tr> : ""}
              { log.task.userId ? <tr><td><b>User ID</b></td><td>{log.task.userId}</td></tr> : ""}
              { log.task.sessionId ? <tr><td><b>Session ID</b></td><td>{log.task.sessionId}</td></tr> : ""}
            </tbody>
          </table>

          {
            log.err && log.err.stack ?
              <div>
                <div className="ui header">Stack Trace</div>
                <div className="ui segment">
                  { log.err.stack }
                </div>
              </div>
            : ""
          }

          <div className="ui accordion">
            <div className="title">
              <i className="dropdown icon"></i>
              View JSON
            </div>
            <div className="content">
              <div className="ui form">
                <textarea rows={25}>{JSON.stringify(log, null, 2)}</textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

$(document).ready(() => {
  ReactDOM.render(
    <TasksList />,
    document.getElementById("tasksList")
  );
});
