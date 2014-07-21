;(function($){
    'use strict';

    var Taxi = function(element, options) {
        this.$element = $(element);
        this.options = options;
        this.sectionData = [];  // populated on draw with objects of section metadata
        this.preventTransform = false;  // when true, calls to transform are ignored
        this.expandedScrollingMode = false;  // when true, prevents calls to transform through the movement handler
        this.scrollLock = new ScrollLock();

        $('body').css('margin', 0);
        this.$element.css('position', 'relative');

        this.draw();
        $(window).resize(this.draw.bind(this));

        if (this.options.guidedScrolling) {
            this.scrollLock.go('lock');
            $(document).on('movement', this._movementHandler.bind(this));
            this.$element.on('sectionchange.taxi', this._expandedScrollHandler.bind(this));
        } else {
            $(document).on('scroll', this._sectionChangeHandler.bind(this));
        }

        if (this.options.hideScrollbar) {
            $("<style type='text/css'>::-webkit-scrollbar { display: none; }</style>").appendTo('head');
        }
    };


    /** Fire events when the section changes.
        Called after transforms complete and on scroll events when
        guidedScrolling is false
    */
    Taxi.prototype._sectionChangeHandler = function() {
        var currentSection = this._currentSection();
        if (this._cur != currentSection) {
            this.$element.trigger('sectionchange.taxi', [currentSection])
        }
        this._cur = currentSection;
    };


    /** Called when guidedScrolling is true and expandedScrollingMode is false.
        Drives transform events based on swipe-like events from user input.
    */
    Taxi.prototype._movementHandler = function(e, direction) {
        if (!this.expandedScrollingMode && !this.preventTransform) {
            if (direction == 'up') { this.previous(true); }
            else if (direction == 'down') { this.next(); }
        }
    };

    /** Called when guidedScrolling is true and the section changes.
        If the current section is an expanded section, it binds expanded
        scroll handlers which give control of scrolling to the user.
        When the user scrolls past the defined boundaries, the handlers
        are unbound, the user is moved to the next section
        and locked scrolling is turned back on.
    */
    Taxi.prototype._expandedScrollHandler = function(e, index) {
        if (this.sectionData[index].expanded) {

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


                }
            }).bind(this);

            this.expandedScrollingMode = true;
            this.scrollLock.go('unlock');
            $(document).on('scroll', checkOnScroll);
        }

    };


    /** Returns the index of the section currently in view.
    */
    Taxi.prototype._currentSection = function() {
        var scrollTop = $(document).scrollTop();

        var i = this.sectionData.length;
        while(i--) {
            if (scrollTop >= this.sectionData[i].top) {
                return i;
            }
        }
        return 0;  // catch negative scrolling browser behaviour
    };


    /** Sizes and positions the sections.
        Called on init and when a section is expanded or contracted.
        Can be manually called if a section is added, updated or removed
    */
    Taxi.prototype.draw = function() {

        var that = this;
        var sectionData = [];
        var viewportHeight = $(window).height();
        var sections = this.$element.children(this.options.sectionSelector);
        var currentPosition = 0;

        sections.each(function(index, el){
            var $el = $(el);
            var section = {
                element: $el,
                top: currentPosition,
                expanded: $el.hasClass(that.options.expandedSectionClass)
            };

            $el.css('height', 'auto');  // ensure appropriate measurement when redrawing
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


        // If a descendent element of a section has a taxi-full-height data attribute,
        // it will be assigned the height of the viewport.
        sections.find('[data-taxi-full-height]').css('height', viewportHeight);

        this.sectionData = sectionData;

        return this;
    };


    /* Aligns the top of the current section to the top of the viewport
    */
    Taxi.prototype.snap = function() {
        var scrollTop = $(document).scrollTop();
        var currentSection = this._currentSection();
        var currentSectionData = this.sectionData[currentSection];

        if (scrollTop != currentSectionData.top) {
            this.transform(currentSectionData.top);
        }

        return this;
    };

    /* Transforms the top of the current section to the top of the viewport.
       If scrollToBottom is true, the bottom of the current section is aligned to the
       bottom of the viewport. (This only makes a difference for expanded sections.
       For sections where the height matches the viewport height, )
    */
    Taxi.prototype.to = function(index, scrollToBottom) {
        if (index >= this.sectionData.length) {
            $.error('Out of range: this instance only has ' + this.sectionData.length + ' sections');
        }

        var cur = this._currentSection();
        var section = this.sectionData[index];
        scrollToBottom = (typeof scrollToBottom === 'boolean') ? scrollToBottom : false;

        if (cur == index) {
            return this.snap();
        }

        if (scrollToBottom) {
            var destination = section.top + section.height - $(window).height();
        } else {
            var destination = section.top;
        }

        this.transform(destination);
        return this;
    };


    Taxi.prototype.previous = function(scrollToBottom) {
        var cur = this._currentSection();
        var index = (cur > 0) ? cur - 1 : cur;
        return this.to(index, scrollToBottom);
    };


    Taxi.prototype.next = function(scrollToBottom) {
        var cur = this._currentSection();
        var index = (cur < this.sectionData.length - 1) ? cur + 1 : cur;
        return this.to(index, scrollToBottom);
    };

    /** The main driver for simulated page scrolls. Accepts a pixel value
     *  which is scrolled to the top of the page. Calls to transform are ignored
     *  when preventTransform is true. The engine that drives animations is
     *  $.fn.taxi.transform.
     */
    Taxi.prototype.transform = function(x) {
        if (this.preventTransform ||
            x < 0 ||
            x > $(document).height()) { return false; }

        var that = this;
        var dfd = $.Deferred();

        this.$element.trigger('transform.start.taxi');
        this.preventTransform = true;
        if (!this.options.guidedScrolling) this.scrollLock.go('lock');

        $.fn.taxi.transform(this.$element, x, this.options).done(function(){
            that.preventTransform = false;
            that._sectionChangeHandler();
            if (!that.options.guidedScrolling) that.scrollLock.go('unlock');
            dfd.resolve();
            that.$element.trigger('transform.end.taxi');
        });

        return dfd.promise();
    };

    /** Sections with overflowing content can be turned into
     *  expanded or non-expanded sections on the fly
     *
     * TODO: rewrite this as Taxi.prototype.expanded(method)
     * which accepts method as a string with values 'expand',
     * 'collapse', or 'toggle'
     */
    Taxi.prototype.toggleExpanded = function(indexOrElement) {
        if (typeof indexOrElement === "number") {
            var index = indexOrElement;
        } else {
            var index = this.$element.children().index(indexOrElement);
        }

        var that = this;
        var section = this.sectionData[index];
        var currentSection = this._currentSection();
        var delta = section.element[0].scrollHeight - $(window).height();
        var currentScroll = $(document).scrollTop();

        if (section.expanded) {

            if (currentSection == index) {
                // Scroll the window back to the top of the section before
                // closing it
                this.transform(section.top).done(function(){
                    section.element.removeClass('expanded');
                    that.draw();
                    that.expandedScrollingMode = false;
                });
            } else if (currentSection > index) {
                // Offset the scroll value by the amount the window size
                // changes to keep the window in the same place

                $(document).scrollTop(currentScroll - delta);
                section.element.removeClass('expanded');
                that.draw();

            } else {
                section.element.removeClass('expanded');
                that.draw();
            }

        } else {

            section.element.addClass('expanded');
            that.draw();

            if (currentSection == index) {
                that._expandedScrollHandler(null, index);
            } else if (currentSection > index) {
                $(document).scrollTop(currentScroll + delta);
            }
        }

    };


    /** ScrollLock toggle's the user's ability to scroll manually,
     *  by scroll wheels, touch events and key presses.
     *  Call ScrollLock.go('lock') to disable scrolling
     *  and ScrollLock.go('unlock') to reenable.
     */
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
                    if (typeof option == 'string' && option in data) {
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

    $.fn.taxi.constructor = Taxi;


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
        expandedScrollOffThreshold: 200,
        hideScrollbar: true
    };

})(jQuery);
