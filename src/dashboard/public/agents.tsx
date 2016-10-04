interface Agent {
  id: number;
  pid: number;
  creationDate: string;
  pagesOpened: number;
}

interface AgentsState {
  agents: Agent[]
}

class AgentsList extends React.Component<{}, AgentsState> { 
  updateInterval: number;

  constructor(props) {
    super(props);

    this.state = {
      agents: []
    };

    this.renderAgents = this.renderAgents.bind(this);
    this.updateAgents = this.updateAgents.bind(this);

    this.updateAgents();
    this.updateInterval = setInterval(this.updateAgents, 5000) as any;
  }

  updateAgents() {
    $.getJSON("bsAgents.json", resp => {
      this.setState({
        agents: resp.agents
      });

      $("#numAgents").html(resp.agents.length);
    });
  }

  componentWillUnmount() {
    clearInterval(this.updateInterval);
  }

  renderAgents() {
    let rows = [];

    for(let agent of this.state.agents) {
      rows.push(
        <tr>
          <td>{agent.id}</td>
          <td>{agent.pid}</td>
          <td><TimeAgo datetime={new Date(agent.creationDate)} /></td>
          <td>{agent.pagesOpened}</td>
        </tr>
      );
    }

    return rows;
  }

  render() {
    return (
      <table id="agentsList" className="ui celled selectable table">
        <thead>
          <tr>
            <th>ID</th>
            <th>PID</th>
            <th>Creation Date</th>
            <th>Pages Opened</th>
          </tr>
        </thead>
        <tbody>
          {this.renderAgents()}
        </tbody>
      </table>
    );
  }
}

$(document).ready(function() {
  ReactDOM.render(
    <AgentsList />,
    document.getElementById("agentsList")
  );
});