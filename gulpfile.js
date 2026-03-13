import gulp from 'gulp';
import inject from 'gulp-inject';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';

const sass = gulpSass(dartSass);

export const buildStyles = () => {
    return gulp.src('./src/scss/index.scss').pipe(
        sass().on('error', sass.logError)
    ).pipe(
        gulp.dest('./temp')
    );
};

export const injectContent = () => {
    return gulp.src('./src/html/index.html').pipe(
        inject(
            gulp.src(['./temp/*.css']),
            {
                starttag: '<!-- inject:head:{{ext}} -->',
                removeTags: true,
                transform: (filePath, file) => {
                    return file.contents.toString('utf8')
                }
            }
        )
    ).pipe(
        inject(
            gulp.src(['./src/js/*.js']),
            {
                starttag: '<!-- inject:body:{{ext}} -->',
                removeTags: true,
                transform: (filePath, file) => {
                    return file.contents.toString('utf8')
                }
            }
        )
    ).pipe(
        gulp.dest('./')
    )
};

export const watch = (done) => {
    gulp.watch(
        [
            './src/scss/*.scss',
            './src/js/*.js',
            './src/html/*.html'
        ],
        gulp.series(
            buildStyles,
            injectContent
        )
    );
    done();
  };

export default gulp.series(buildStyles, injectContent, watch);