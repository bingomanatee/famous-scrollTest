# Scroll Test

This is the first proof of concept for testing Famous' scroll region.

In anticipation of  more complex scenarios (3d tilting, etc.) computer vision is used on a snapshot
taken by webdriver of a specially colored set of surfaces after a few seconds of scrolling.

The test is run on a Scroll Container.

wd opens a page in Google Chrome and sets the window size to a fixed size (800 px x 500 px).

The scrolling is initiated by a click on a button to start a free-fall scroll at low speed:

``` javascript

    scroller.scrollview._eventInput.emit('start', {slip: true});
        buttonMod.setOpacity(0);
        setTimeout(function () {
            scroller.scrollview._eventInput.emit('update', {delta: -120, position: -120, velocity: -0.1, slip: true});
        }, 10);
```

(clicking also self-hides the button).

After two seconds, the state of the page is screenshot and the page is closed.

Then a computer vision(openCV) scan is run on the shapes found and the perimiter of each surface is found.
The center of each rectangle is found by averaging all the contour points.
The color at that center is also measured (via canvas) and all the above data is saved.

Then a linear regression is made comparing the known expected non-black surfaces' colors against the known order of
surface colors. All the above data is saved to JSON.

The expected output is around slope = 49 (due to the size of the surface and an intercept of -149 (about how far the
surfaces travel.

A few runs show that these numbers are consistent from test to test
(+/-2 px slope at the extreme, +/- 5 on the surfaces travel.

A more thorough statistical analysis is to come.

