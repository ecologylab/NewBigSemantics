// Utility functions.

/// <reference path="../../typings/index.d.ts" />

export function parseJson(s: string): any {
  try {
    var result = JSON.parse(s);
    return result;
  } catch (exception) {
    return new Error("Failed to parse JSON, exception: " + exception);
  }
}
