// Build new BigSemantics

var gulp = require('gulp');
var gutil = require('gulp-util');
var ts = require('gulp-typescript');
var jasmine = require('gulp-jasmine');
var del = require('del');

var bsTsProject = ts.createProject('BigSemanticsJavaScript/tsconfig.json');
var tsProject = ts.createProject('fake-tsconfig.json');

gulp.task('compile-bigsemantics', function() {
  return bsTsProject.src().pipe(bsTsProject()).js.pipe(gulp.dest('build'));
});

gulp.task('compile', function() {
  return tsProject.src().pipe(tsProject()).js.pipe(gulp.dest('build'));
});

gulp.task('copy-files', function() {
  var files = [
    "src/dpool/script/*",
    "src/phantom/static/*",
    "src/phantom/*.js",
    "src/bscore/test/*.html",
    "src/dashboard/**/*"
  ];
  return gulp.src(files, { base: 'src' }).pipe(gulp.dest('build'));
});

gulp.task('default', [ 'compile-bigsemantics', 'compile', 'copy-files' ]);

gulp.task('clean', function() {
  del.sync(['build']);
});

gulp.task('testExtractor', function() {
  gulp.src('build/bscore/test/testExtractor.js').pipe(jasmine());
});

gulp.task('testHttpRespParser', function() {
  gulp.src('build/dpool/test/testHttpRespParser.js').pipe(jasmine());
});

gulp.task('test', [ 'testExtractor', 'testHttpRespParser' ]);
