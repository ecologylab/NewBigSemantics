
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
  $.get("bsTask.json?id=" + taskId, task => {
    ReactDOM.render(
      <TaskView task={task} />,
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
  task: Task;
}

class TaskRow extends React.Component<TaskProps, {}> {
  render() {
    var id = this.props.task.id;

    var idContent = id ? (<a onClick={() => showDetails(this.props.task.id)}>{id}</a>) : "";

    var errorLevel = this.props.task.level;
    var cls = "positive";
    if(errorLevel == 50 || errorLevel == 60)
      cls = "error";
    else if(errorLevel == 40)
      cls = "warning";

    return (
      <tr className={cls}>
        <td><TimeAgo datetime={new Date(this.props.task.time)} /></td>
        <td className="selectable">
          {idContent}
        </td>
        <td>
          {this.props.task.msg}
        </td>
      </tr>
    );
  }
}

interface TasksState {
  page: number;
  tasks: any[];
}

class TasksList extends React.Component<{}, TasksState> {
  constructor(props) {
    super(props);

    this.state = {
      page: 0,
      tasks: []
    };

    this.updateTasks();
    setInterval(() => {
      this.updateTasks();
    }, 5000);
  }

  updateTasks() {
    $.getJSON("bsTasks.json?page=" + this.state.page, resp => {
      resp.tasks.reverse();

      if(this.state.tasks.length > 0) {
        if(resp.tasks[0].id == this.state.tasks[0].id)
          return;
      }

      this.setState({
        page: this.state.page,
        tasks: resp.tasks
      });

      $("#numTasks").html(resp.numTasks);
      $("#numSuccesses").html(resp.successes);
      $("#numWarnings").html(resp.warnings);
      $("#numFailures").html(resp.failures);
    });
  }

  render() {
    let rows = [];

    for(let task of this.state.tasks) {
      rows.push(<TaskRow task={task} />);
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
    let task = this.props.task;

    let logs = [];
    for(let log of task.logs) {
      logs.push(
        <tr>
          <td><span>{new Date(log.datetime).toDateString()}</span></td>
          <td>{log.name}</td>
          <td>{!(log.args && log.args.stack) ? log.args : ""}</td>
        </tr>
      );
    }

    return (
      <div id="taskModal" className="ui long modal">
        <div className="header">{task.msg}</div>
        <div className="content">
          <table className="ui celled striped table">
          <tbody>
            <tr>
              <td><b>ID</b></td>
              <td>{task.id}</td>
            </tr>
            <tr>
              <td><b>URL</b></td>
              <td>{task.url}</td>
            </tr>
            <tr>
              <td><b>Hostname</b></td>
              <td>{task.hostname}</td>
            </tr>
            <tr>
              <td><b>PID</b></td>
              <td>{task.pid}</td>
            </tr>
            <tr>
              <td><b>Timestamp</b></td>
              <td><span>{new Date(task.time).toDateString()}</span></td>
            </tr>
          </tbody>
        </table>

        <div className="ui header">Task Logs</div>
          <table className="ui celled striped table">
            <thead>
              <tr>
                <th>Timestamp</th>
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
              <tr><td><b>IP</b></td><td>{task.reqIp}</td></tr>
              { task.reqId ? <tr><td><b>Request ID</b></td><td>{task.reqId}</td></tr> : ""}
              { task.appId ? <tr><td><b>Application ID</b></td><td>{task.appId}</td></tr> : ""}
              { task.userId ? <tr><td><b>User ID</b></td><td>{task.userId}</td></tr> : ""}
              { task.sessionId ? <tr><td><b>Session ID</b></td><td>{task.sessionId}</td></tr> : ""}
            </tbody>
          </table>

          {
            task.stack ?
              <div>
                <div className="ui header">Stack Trace</div>
                <div className="ui segment">
                  {task.stack}
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
                <textarea rows={25}>{JSON.stringify(task, null, 2)}</textarea>
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
