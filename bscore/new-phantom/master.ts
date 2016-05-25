// The phantom master

import * as child_process from 'child_process';

export class Phantom {
  
  private

  constructor() {
    this.proc = child_process.spawnSync("phantomjs", [ bridgePath ]);
  }

}

