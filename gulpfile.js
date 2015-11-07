// Build new BigSemantics

var gulp = require('gulp');
var shell = require('gulp-shell');

gulp.task('tsc', shell.task('tsc', { ignoreErrors: true }));

gulp.task('copy-js', function() {
  return gulp.src('src/**/*.js').pipe(gulp.dest('build/'));
});

gulp.task('default', ['tsc', 'copy-js']);

