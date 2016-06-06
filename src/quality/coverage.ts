// Calculate coverage score.
import editDistance = require('./edit-distance');

export var fieldsToSkip = [
  'meta_metadata_name',
  'mm_name',
  'download_status',
  'log_record',
];

// Compares a target scalar value against a baseline scalar value.
//
// Assumes that the baseline value is not undefined or null.
//
// Returns a single number between [0, 1] indicating coverage on this single
// scalar value.
//
// Current scheme:
// - If target value does not exist, returns 0
// - If both type and value match, returns 1
// - Or, if values match after converting to String, returns 0.9
// - Or, if String values do not match exactly but edit distance is within half
//   of baseline length , returns 0.5
// - Or, if values are of the same type, returns 0.2
// - Otherwise, returns 0
export function scalarCoverage(baseline_val: any, target_val: any) {
  function normalize(val: any) {
    return String(val).toLowerCase().trim();
  }
  if (target_val === undefined || target_val == null) {
    return 0;
  }
  if (baseline_val === target_val) {
    return 1;
  }
    
  if (normalize(baseline_val) === normalize(target_val)) {
    return 0.9;
  }
  
  if (typeof baseline_val == 'string' && typeof target_val == 'string') {
    /* && editDistance(baseline_val, target_val) < baseline_val.length / 2*/ 
    //return 0.5
    var distance = editDistance(baseline_val, target_val);
    var val = 1 - (distance / Math.max(baseline_val.length, target_val.length));
    
    //return a minimum of 0.2, since we give values of the same type 0.2 anyways
    if(val < 0.2) return 0.2;
    return val;
  }
  
  if (typeof baseline_val == typeof target_val) {
    return 0.2;
  }
  
  return 0;
}

// Compares a target object against a baseline object.
// Returns [ total, covered ], where total is the maximum possible coverage, and
// covered is the actual coverage.
export function objectCoverage(baseline_obj: Object, target_obj: any) {
  var total = 0, covered = 0;

  var keys = Object.keys(baseline_obj);
  for (var i in keys) {
    var key = keys[i];
    if (fieldsToSkip.indexOf(key) !== -1) { continue; }

    var baseline_val = baseline_obj[key];
    
    var target_val = (typeof target_obj == 'object' && target_obj != null) ? target_obj[key] : null;
    var results = coverage(baseline_val, target_val);
    
    if(results[0] != results[1]) {
      console.log("Mismatch in key '" + keys[i] + "' - " + results[0] + " != " + results[1]);
    }
    
    total += results[0];
    covered += results[1];
  }

  return [ total, covered ];
}

// Compares a target array against a baseline array.
// Returns [ total, covered ].
export function arrayCoverage(baseline_arr: Array<any>, target_arr: any) {
  var total = 0, covered = 0;

  for (var i in baseline_arr) {
    var baseline_val = baseline_arr[i];
    
    var results = [0, 0];
    if(target_arr instanceof Array) {
      var maxObject = null;
      for(var target_obj of target_arr) {
        var newResults = coverage(baseline_val, target_obj);
        
        if(newResults[1] > results[1]) {
          results = newResults;
          maxObject = target_obj;
        }
      }
    } else {
      var target_val = (target_arr instanceof Array) ? target_arr[i] : null;
      results = coverage(baseline_val, target_val);
    }
    total += results[0];
    covered += results[1];
  }

  return [ total, covered ];
}

// Recursively compare a target value against a baseline value. Here the
// baseline and target can be anything.
//
// return: [ total, covered ]
export function coverage(baseline: any, target: any) {
  var total = 0, covered = 0;

  if (baseline !== undefined && baseline != null) {
    switch (typeof baseline) {
      case 'string':
      case 'number':
      case 'boolean':
        total += 1;
        if ([ 'string', 'number', 'boolean' ].indexOf(typeof target) >= 0) {
          covered += scalarCoverage(baseline, target);
        }
        break;
      case 'object':
        if (baseline instanceof Array) {
          var arr_results = arrayCoverage(baseline, target);
          total += arr_results[0];
          covered += arr_results[1];
        } else {
          var obj_results = objectCoverage(baseline, target);
          total += obj_results[0];
          covered += obj_results[1];
        }
        break;
      default:
        console.warn("Object type unknown", baseline);
        break;
    }
  }

  return [ total, covered ];
}

