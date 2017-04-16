const gulp     = require('gulp');
const babel    = require('gulp-babel');
const rename   = require('gulp-rename');
const combiner = require('stream-combiner2');
const { exec } = require('child_process');

gulp.task('babel', () => {
  const combined = combiner.obj([
    gulp.src('./main.js'),
    babel(),
    rename('main_transpiled.js'),
    gulp.dest('./')
  ]);

  combined.on('error', console.error.bind(console));

  return combined;
});

gulp.task('execute', ['babel'], () => {
  exec('node main_transpiled.js', (error, stdout) => {
    if (error) console.log(error);
    console.log(stdout);
  });
});

gulp.task('serve', ['babel', 'execute'], () => {
  gulp.watch('./main.js', ['babel', 'execute']);
});

gulp.task('default', ['serve']);
