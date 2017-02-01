// thanks to GitHub's time-elements

interface TimeAgoProps {
  datetime: Date;
}

interface TimeAgoState {
  text: string;
}

class TimeAgo extends React.Component<TimeAgoProps, TimeAgoState> {
  static timeElements: TimeAgo[];
  static updateTimer: number;
  
  inner: any;
  
  constructor(props) {
    super(props);

    this.timeElapsed = this.timeElapsed.bind(this);
    this.update = this.update.bind(this);

    this.state = {
      text: ""
    };

    this.inner = this;
  }

  update() {
    this.setState({
      text: this.timeElapsed()
    });
  }

  static updateAll() {
    for(let ele of TimeAgo.timeElements) 
      ele.update.bind(ele.inner)();
  }

  timeElapsed() {
    var ms = new Date().getTime() - this.props.datetime.getTime();
    var sec = Math.round(ms / 1000);
    var min = Math.round(sec / 60);
    var hr = Math.round(min / 60);
    var day = Math.round(hr / 24);
    var month = Math.round(day / 30);
    var year = Math.round(month / 12);

    if (ms < 0) {
      return 'just now';
    } else if (sec < 10) {
      return 'just now';
    } else if (sec < 45) {
      return sec + ' seconds ago';
    } else if (sec < 90) {
      return 'a minute ago';
    } else if (min < 45) {
      return min + ' minutes ago';
    } else if (min < 90) {
      return 'an hour ago';
    } else if (hr < 24) {
      return hr + ' hours ago';
    } else if (hr < 36) {
      return 'a day ago';
    } else if (day < 30) {
      return day + ' days ago';
    } else if (day < 45) {
      return 'a month ago';
    } else if (month < 12) {
      return month + ' months ago';
    } else if (month < 18) {
        return 'a year ago';
    } else {
      return year + ' years ago';
    }
  }

  componentDidMount() {
    this.update();

    if(!TimeAgo.timeElements)
      TimeAgo.timeElements = []

    if(TimeAgo.timeElements.length == 0) {
      TimeAgo.updateTimer = setInterval(() => {
        TimeAgo.updateAll();
      }, 5000) as any;
    }
    
    TimeAgo.timeElements.push(this);
  }

  componentWillUnmount() {
    let index = TimeAgo.timeElements.indexOf(this);

    if(index > -1)
      TimeAgo.timeElements.splice(index, 1);

    if(TimeAgo.timeElements.length == 0)
      clearTimeout(TimeAgo.updateTimer);
  }

  render() {
    return (
      <span>{this.state.text}</span>
    );
  }
}

function getFormattedDate(date: Date) {
    let pad = n => (n < 10 ? "0" : "") + n;

    let month = pad(date.getMonth() + 1);
    let day = pad(date.getDate());
    let hour = pad(date.getHours());
    let min = pad(date.getMinutes());
    let sec = pad(date.getSeconds());
    let period = date.getHours() >= 12 ? "PM" : "AM";

    return `${date.getFullYear()}-${month}-${day} ${hour}:${min}:${sec} ${period}`;
}
