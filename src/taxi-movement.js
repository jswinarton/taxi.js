/**
 * taxi-movement.js
 * A helper event that detects swipe-like events from multiple input sources.
 * Swipe events from touch screen devices, a subset of keyboard events and simulated
 * swipe events from trackpads and mousewheels will fire 'movement' events.
 *
 */
;(function($){

    var previousTouchStart = [];

    var touchStart = function(e) {
        var touches = e.originalEvent.touches;
        if (touches && touches.length) {
            previousTouchStart = [touches[0].pageX, touches[0].pageY]
        }
    }

    var touchMove = function(e) {
        var trigger = $(this).triggerHandler;
        var touches = e.originalEvent.touches;
        var delta;

        if (touches && touches.length) {
            var delta = [
                previousTouchStart[0] - touches[0].pageX,
                previousTouchStart[1] - touches[0].pageY
            ];

            var axis = (Math.abs(delta[0]) > Math.abs(delta[1])) ? 'x' : 'y';
            var strength = Math.abs(delta[0]) + Math.abs(delta[1]);

            if (strength > 25) {
                if (axis == 'x') {
                    direction = (delta[0] >= 0) ? 'right' : 'left';
                } else {
                    direction = (delta[1] >= 0) ? 'down' : 'up';
                }

                $(this).triggerHandler('movement', [direction])
            }
        }
    }

    var wheelMove = function(e) {
        var target = $(this);
        var e = window.event || e;
        e = e.originalEvent ? e.originalEvent : e;
        var delta = e.detail ? e.detail : e.wheelDelta;

        if (Math.abs(delta) >= 30) {
            var direction = (delta > 0) ? 'up' : 'down';
            target.triggerHandler('movement', [direction]);
        }
    }

    var keyDown = function(e) {
        var target = $(this);
        var keyCodes = {
            38: 'up', // up arrow
            33: 'up', // page up
            87: 'up', // 'W'
            40: 'down', // down arrow
            34: 'down', // page down
            32: 'down', // spacebar
            83: 'down', // 'S'
            37: 'left', // left arrow
            65: 'left', // 'A'
            39: 'right', // right arrow
            68: 'right' // 'D'
        }

        if (e.which in keyCodes) {
            var direction = keyCodes[e.which];
            target.triggerHandler('movement', [direction]);
        }
    }

    $.event.special.movement = {
        add: function(handleObj) {
            $(this)
                .on('mousewheel DOMMouseScroll MozMousePixelScroll', wheelMove)
                .on('touchstart', touchStart)
                .on('touchmove', touchMove);
                // .on('keydown', keyDown);
        },
        remove: function(handleObj) {
            $(this)
                .off('mousewheel DOMMouseScroll MozMousePixelScroll', wheelMove)
                .off('touchstart', touchStart)
                .off('touchmove', touchMove);
                // .off('keydown', keyDown);
        }
    };

})(jQuery);
