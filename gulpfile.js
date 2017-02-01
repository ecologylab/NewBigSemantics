// Build new BigSemantics

var cp = require('child_process');
var argv = require('yargs').argv;
var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var ts = require('gulp-typescript');
var rename = require('gulp-rename');
var del = require('del');
var jasmine = require('gulp-jasmine');

var env = argv.env || 'dev';
var isDev = env === 'dev';
console.log("Environment (specify with --env when calling gulp): " + env);

gulp.task('compile-bigsemantics-core', function(callback) {
  var cmd = 'gulp --env=' + env;
  cp.exec(cmd, {
    cwd: './BigSemanticsJavaScript',
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }
    callback();
  });
});

gulp.task('copy-bigsemantics-core', [ 'compile-bigsemantics-core' ], function() {
  gulp.src('./BigSemanticsJavaScript/build/**/*').pipe(gulp.dest('./build'));
});

gulp.task('compile', [ 'copy-bigsemantics-core' ], function() {
  var tsProject = ts.createProject('tsconfig.json');
  return gulp.src('src/**/*.ts*', { base: 'src' }).pipe(sourcemaps.init()).pipe(tsProject({
    rootDir: '.',
  })).js.pipe(rename(function(path) {
    if (path.dirname.substr(0, 4) === 'src/') {
      path.dirname = path.dirname.substr(4);
    }
  })).pipe(sourcemaps.write()).pipe(gulp.dest('build'));
});

gulp.task('copy-files', function() {
  var files = [
    "src/dpool/script/*",
    "src/phantom/static/*",
    "src/phantom/*.js",
    "src/bscore/test/*.html",
    "src/dashboard/**/*.tsx"
  ];
  return gulp.src(files, { base: 'src' }).pipe(gulp.dest('build'));
});

gulp.task('default', [ 'compile', 'copy-files' ]);

gulp.task('clean', function(callback) {
  del.sync([ 'build' ]);
  cp.exec('gulp clean', {
    cwd: './BigSemanticsJavaScript',
  }, function(err) {
    if (err) {
      callback(err);
      return;
    }
    callback();
  });
});

gulp.task('testExtractor', function() {
  gulp.src('build/bscore/test/testExtractor.js').pipe(jasmine());
});

gulp.task('testHttpRespParser', function() {
  gulp.src('build/dpool/test/testHttpRespParser.js').pipe(jasmine());
});

gulp.task('test', [ 'testExtractor', 'testHttpRespParser' ]);
