;(function($){
    'use strict';

    var Taxi = function(element, options) {
        var that = this;
        this.$element = $(element);
        this.options = options;
        this.sectionData = [];
        this.scrollLock = new ScrollLock();
        this.preventScroll = false;
        this.expandedScrollingMode = false;

        $('body').css('margin', 0);
        this.$element.css('position', 'relative');

        this.draw();
        $(window).resize(this.draw.bind(this));
        $(document).on('movement', this.movementHandler.bind(this));

        if (this.options.guidedScrolling) {
            this.scrollLock.go('lock');
            this.$element.on('sectionchange.taxi', this.expandedScrollHandler.bind(this));
        }
    };

    Taxi.prototype.draw = function() {
        // Sizes and positions the sections
        // and caches the section data in this.sectionData.
        // Call if a section is added or removed

        var sectionData = [];
        var viewportHeight = $(window).height();
        var sections = this.$element.children(this.options.sectionSelector);
        var currentPosition = 0;
        var taxi = this;

        sections.each(function(index, el){
            var $el = $(el);
            var section = {
                element: $el,
                top: currentPosition,
                expanded: $el.hasClass(taxi.options.expandedSectionClass)
            };

            var height = (section.expanded) ? section.element.outerHeight() : viewportHeight;
            section.height = height;

            sectionData.push(section);

            section.element.css({
                position: 'absolute',
                top: section.top,
                width: '100%',
                height: height,
                overflow: 'hidden',
            });

            currentPosition += height;

        });

        this.sectionData = sectionData;

        return this;
    };

    Taxi.prototype.currentSection = function() {
        // returns the index of the section currently in view
        var scrollTop = $(document).scrollTop();

        var i = this.sectionData.length;
        while(i--) {
            if (scrollTop >= this.sectionData[i].top) {
                return i;
            }
        }
        return 0;  // catch negative scrolling browser behaviour
    };

    Taxi.prototype.to = function(index) {
        if (index >= this.sectionData.length) {
            $.error('Out of range: this instance only has ' + this.sectionData.length + ' sections');
        }

        if (this.preventScroll) { return false; }

        // If the scroll direction is up, scroll to the bottom of the section
        // instead of the top. Accounts for expanded sections
        var cur = this.currentSection();
        var section = this.sectionData[index];
        if (cur < index) {
            var destination = section.top;
        } else {
            var destination = section.top + section.height - $(window).height();
        }

        this.transform(destination);
        return this;
    };

    Taxi.prototype.previous = function() {
        var cur = this.currentSection();
        return (cur > 0) ? this.to(cur-1) : false;
    };

    Taxi.prototype.next = function() {
        var cur = this.currentSection();
        return (cur < this.sectionData.length -1) ? this.to(cur+1) : false;
    };

    Taxi.prototype.transform = function(x) {
        var that = this;
        this.scrollLock.go('lock');
        this.preventScroll = true;

        $.fn.taxi.transform(this.$element, x, this.options).done(function(){
            that.preventScroll = false;
            !that.options.guidedScrolling && that.scrollLock.go('unlock');
            that.checkSectionChange();
        });

        return this;
    };

    Taxi.prototype.checkSectionChange = function() {
        var currentSection = this.currentSection();
        if (this._currentSection != currentSection) {
            this.$element.trigger('sectionchange.taxi', [currentSection])
        }
        this._currentSection = currentSection;
    };


    Taxi.prototype.movementHandler = function(e, direction) {
        if (this.options.guidedScrolling && !this.expandedScrollingMode) {
            if (!this.preventScroll) {
                if (direction == 'up') { this.previous(); }
                else if (direction == 'down') { this.next(); }
            }
        }
    };

    Taxi.prototype.expandedScrollHandler = function(e, index) {
        if (this.sectionData[index].expanded) {

            /* Checks to ensure that the expanded scrolling section
               hasn't scrolled past the boundaries. If it has, revert to
               regular scrolling mode and unbind itself
             */
            var checkOnScroll = (function() {
                var viewportHeight = $(window).height();
                var viewportTop = $(document).scrollTop();
                var height = this.sectionData[index].height;
                var top = this.sectionData[index].top;

                var lowerLimit = viewportHeight + viewportTop > top + height + this.options.expandedScrollOffThreshold;
                var upperLimit = viewportTop < top - this.options.expandedScrollOffThreshold;

                if (upperLimit || lowerLimit) {
                    this.expandedScrollingMode = false;
                    this.scrollLock.go('lock');
                    $(document).off('scroll', checkOnScroll);


                    // We need a solution to scroll to the top of a certain section
                    // if it's halfway between sections
                    // because the below code now does nothing

                    // if (upperLimit) {
                    //     $(document).scrollTop(top - this.options.expandedScrollOffThreshold);
                    // } else {
                    //     $(document).scrollTop(top + height - viewportHeight + this.options.expandedScrollOffThreshold);
                    // }

                }
            }).bind(this);

            this.expandedScrollingMode = true;
            this.scrollLock.go('unlock');
            $(document).on('scroll', checkOnScroll);
        }

    };

    Taxi.prototype.publicMethods = [
        'draw',
        'to',
        'next',
        'previous',
        'currentSection'
    ];


    var ScrollLock = function(){
        this.isLocked = false;
        this.evtString = 'mousewheel.scrolllock DOMMouseScroll.scrolllock \
            MozMousePixelScroll.scrolllock touchstart.scrolllock \
            touchmove.scrolllock keydown.scrolllock'; // keydown.scrolllock';
        this.lockHandler = function(e) {
            var keycodes = [33, 32, 34, 37, 38, 39, 40, 65, 68, 83, 87];
            if (e.type !== 'keydown' || keycodes.indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
        }
    };

    ScrollLock.prototype.go = function(action) {
        if (!action) return this.isLocked;

        if (action == 'lock' && !this.isLocked) {
            $(document).on(this.evtString, this.lockHandler);
            this.isLocked = true;
        } else if (action == 'unlock' && this.isLocked) {
            $(document).off(this.evtString, this.lockHandler);
            this.isLocked = false;
        }
    };

    // Plugin definition
    // =================

    $.fn.taxi = function(option) {
        var nargs = Array.prototype.slice.call(arguments, 1);
        return this.each(function(){
            var $this = $(this);
            var data = $this.data('jquery.taxi');
            var options = $.extend({}, $.fn.taxi.defaults, typeof option == 'object' && option);

            if (!data) {
                $this.data('jquery.taxi', (data = new Taxi(this, options)));
            } else {
                if (option) {
                    if (typeof option == 'string' && data.publicMethods.indexOf(option) > -1) {
                        return data[option].apply(data, nargs);
                    } else {
                        $.error('Method ' +  option + ' does not exist on jQuery.taxi');
                    }
                }
            }
        });
    };

    // Extendable methods and objects
    // =================

    /*
    The built in transform function uses CSS3 transitions for better
    performance. You can override this method with your own implementation.
    The transform method takes three arguments:
        element — the parent element that contains the sections
        x — the pixel position being scrolled to
        options — an object containing user-specified options
    The method should return a jQuery promise object that is resolved upon
    completion of the animations.
    */

    $.fn.taxi.transform = function(element, x, options) {
        var dfd = $.Deferred();

        var currentPos = $(document).scrollTop();
        var delta = x - currentPos;
        var transitionString = options.scrollSpeed + 'ms ease';
        var transformString = 'translate(0, ' + delta + 'px)';

        $(window).scrollTop(x);
        element.css({
            '-webkit-transform': transformString,
            'transform': transformString
        })
        element[0].offsetHeight; // trigger reflow, flush CSS
        element.css({
            'transform': 'translate(0, 0)',
            '-webkit-transform': 'translate(0, 0)',
            'transition': transitionString,
            '-webkit-transition': transitionString
        });
        element[0].offsetHeight; // trigger reflow, flush CSS
        element.css({
            '-webkit-transition': '0ms ease',
            'transition': '0ms ease',
        });

        element.one('transitionend webkitTransitionEnd', dfd.resolve);
        return dfd.promise();
    };

    $.fn.taxi.defaults = {
        sectionSelector: 'section',
        expandedSectionClass: 'expanded',
        guidedScrolling: true,
        scrollSpeed: 1000,
        expandedScrollOffThreshold: 200
    };

})(jQuery);
