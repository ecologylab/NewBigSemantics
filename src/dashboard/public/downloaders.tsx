interface Downloader {
  id: number;
  socksPort: number;
  stats: { speed: number; };
  state: string;
}

interface DownloadersState {
  downloaders: Downloader[];
}

class DownloadersList extends React.Component<{}, DownloadersState> {
  updateInterval: number;

  constructor() {
    super();

    this.state = {
      downloaders: []
    };

    this.renderDownloaders = this.renderDownloaders.bind(this);
    this.updateDownloaders = this.updateDownloaders.bind(this);

    this.updateDownloaders();
    this.updateInterval = setInterval(this.updateDownloaders, 5000) as any;  
  }

  componentWillUnmount() {
    clearInterval(this.updateInterval);
  }

  updateDownloaders() {
    $.get("../downloaders.json", resp => {
      let ready = 0;
      let unresponsive = 0;

      for(let worker of resp) {
        let seconds = worker.stats.downloadTime / 1000;
        let megabits = worker.stats.downloadBytes / 1024 / 128;

        worker.stats.speed = megabits / seconds;

        if(worker.state == "ready" || worker.state == "busy") {
          ready += 1;
        } else {
          unresponsive += 1;
        }
      }

      this.setState({
        downloaders: resp
      });
      
      $("#numDownloaders").html(resp.length);
      $("#readyDownloaders").html(ready as any);
      $("#unresponsiveDownloaders").html(unresponsive as any);
    });
  }

  renderDownloaders() {
    let rows = [];

    for(let downloader of this.state.downloaders) {
      let cls = "";

      if(downloader.state != "ready" && downloader.state != "busy") {
        cls = "error";
      } else {
        cls = "positive"
      }
      
      rows.push(
        <tr className={cls}>
          <td>{downloader.id}</td>
          <td>{downloader.socksPort}</td>
          <td>{downloader.stats.speed}</td>
          <td>{downloader.state}</td>
        </tr>
      );
    }

    return rows;
  }

  render() {
    return (
      <table className="ui celled selectable table">
        <thead>
          <tr>
            <th>Host</th>
            <th>Local Port</th>
            <th>Avg. Download Rate</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          { this.renderDownloaders }
        </tbody>
      </table>
    );
  }
}

$(document).ready(() => {
  ReactDOM.render(
    <DownloadersList />,
    document.getElementById("downloadersList")
  );
});