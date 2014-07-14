;(function($){
    'use strict';

    var Confessional = function(element, options) {
        this.$element = $(element);
        this.options = options;
        this.sectionData = [];
        this.scrollLock = new ScrollLock();
        this.transforming = false;

        $('body').css('margin', 0);
        this.$element.css('position', 'relative');
        this.options.guidedScrolling && this.scrollLock.go('lock');

        this.draw();
        $(window).resize(this.draw.bind(this));
        $(document).on('movement', this.movementHandler.bind(this));

        this._currentSection = this.currentSection();
    };

    Confessional.prototype.draw = function() {
        // Sizes and positions the sections
        // and caches the section data in this.sectionData.
        // Call if a section is added or removed

        var sectionData = [];
        var viewportHeight = $(window).height();
        var sections = this.$element.children(this.options.sectionSelector);
        var currentPosition = 0;
        var confessional = this;

        sections.each(function(index, el){
            var $el = $(el);
            var section = {
                element: $el,
                top: currentPosition,
                expanded: $el.hasClass(confessional.options.expandedSectionClass)
            };
            sectionData.push(section);

            var height = (section.expanded) ? section.element.outerHeight() : viewportHeight;

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

    Confessional.prototype.currentSection = function() {
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

    Confessional.prototype.to = function(index) {
        if (index >= this.sectionData.length) {
            $.error('Out of range: this instance only has ' + this.sectionData.length + ' sections');
        }

        if (this.transforming) { return false; }

        var destination = parseInt(this.sectionData[index].element.css('top'));
        this.transform(destination);
        return this;
    };

    Confessional.prototype.previous = function() {
        var cur = this.currentSection();
        return (cur > 0) ? this.to(cur-1) : false;
    };

    Confessional.prototype.next = function() {
        var cur = this.currentSection();
        return (cur < this.sectionData.length -1) ? this.to(cur+1) : false;
    };

    Confessional.prototype.transform = function(x) {
        var that = this;
        this.scrollLock.go('lock');
        this.transforming = true;

        $.fn.confessional.transform(this.$element, x).done(function(){
            that.transforming = false;
            !that.options.guidedScrolling && that.scrollLock.go('unlock');
            that.checkSectionChange();
        });

        return this;
    };

    Confessional.prototype.movementHandler = function(e, direction) {
        if (this.options.guidedScrolling) {
            if (!this.transforming) {
                if (direction == 'up') { this.previous(); }
                else if (direction == 'down') { this.next(); }
            }
        }
    };

    Confessional.prototype.checkSectionChange = function() {
        var currentSection = this.currentSection();
        if (this._currentSection != currentSection) {
            this.$element.trigger('sectionchange.confessional', [currentSection])
        }
        this._currentSection = currentSection;
    };

    Confessional.prototype.publicMethods = [
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
            touchmove.scrolllock keydown.scrolllock';
        this.lockHandler = function(e) {
            e.preventDefault();
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

    $.fn.confessional = function(option) {
        var nargs = Array.prototype.slice.call(arguments, 1);
        return this.each(function(){
            var $this = $(this);
            var data = $this.data('jquery.confessional');
            var options = $.extend({}, $.fn.confessional.defaults, typeof option == 'object' && option);

            if (!data) {
                $this.data('jquery.confessional', (data = new Confessional(this, options)));
            } else {
                if (option) {
                    if (typeof option == 'string' && data.publicMethods.indexOf(option) > -1) {
                        return data[option].apply(data, nargs);
                    } else {
                        $.error('Method ' +  option + ' does not exist on jQuery.confessional');
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
    The transform method accepts one argument, which is the pixel position
    being scrolled to. Returns a jQuery promise object which is resolved upon
    completion of the animations.
    */
    $.fn.confessional.transform = function(element, x) {
        var dfd = $.Deferred();

        var currentPos = $(document).scrollTop();
        var delta = x - currentPos;

        $(window).scrollTop(x);

        element.css('margin-top', delta);
        element[0].offsetHeight; // trigger reflow, flush CSS
        element.css({
            '-webkit-transition': 'all 1000ms ease',
            'transition': 'all 1000ms ease',
            'margin-top': 0
        });
        element[0].offsetHeight; // trigger reflow, flush CSS
        element.css({
            '-webkit-transition': 'all 0ms ease',
            'transition': 'all 0ms ease',
        });

        element.one('transitionend webkitTransitionEnd', dfd.resolve);

        return dfd.promise();
    };

    $.fn.confessional.defaults = {
        sectionSelector: 'section',
        expandedSectionClass: 'expanded',
        guidedScrolling: true
    };

})(jQuery);
