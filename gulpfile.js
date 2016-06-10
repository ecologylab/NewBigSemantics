// Build new BigSemantics

var gulp = require('gulp');
var gutil = require('gulp-util');
var ts = require('gulp-typescript');

var tsProject = ts.createProject('tsconfig.json');

gulp.task('tsc', function() {
  return tsProject.src().pipe(ts(tsProject)).js.pipe(gulp.dest('build'));
});

gulp.task('copy-files', function() {
  var files = [
    "src/dpool/script/*",
    "src/phantom/static/*",
    "src/phantom/*.js",
    "src/bscore/test/*.html"
  ];
  return gulp.src(files, { base: 'src' }).pipe(gulp.dest('build'));
});

gulp.task('default', ['tsc', 'copy-files']);
