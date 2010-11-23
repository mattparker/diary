/*
Copyright (c) 2010, Lamplight Database Systems Limited, http://www.lamplightdb.co.uk
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 1.4
*/


/**
 * YAHOO.widget.Diary produces a weekly diary showing events, and allows them to
 * be editted.
 *
 * @module diary
 * @requires yahoo, event, event-delegate, event-mouseenter, dom, datasource, selector, dragdrop, resize, datemath, calendar
 * @optional anim, container
 * @title Diary widget
 *
 * @description
 * <p>Diary uses a YAHOO.util.Datasource with, minimally, start and end dates.
 * Items in the diary can be rescheduled using drag and drop, or times changed using resize.
 * New items can be added by click-and-dragging on the diary to provide the 
 * start and end times.</p>
 *
 *
 * <strong>Changelog</strong>
 * v 1.0    Initial release.  Core data, UI, navigation and events.
 * v 1.1    Single day view added
 * v 1.2    - Month view added.  
 *          - Bug fix on Opera to set height and scrollTop.
 *          - itemBeforeStartMove passed originEvent through to subscribers.
 * v 1.3    Added footer and footerText config property.  
 *          - Added dataRequest method
 *          - Minor fixes
 * v 1.31   Items expand or contract in width when filters are added/removed
 * v 1.32   Added a silent parameter to DiaryItem._handleDiaryEndDrag() to prevent events.
 * v 1.4    Added year view.  Fixed bug with multi-day items and with BST/GMT month view.
 *
 */
(function () {


    var Dom = YAHOO.util.Dom,
        Ev  = YAHOO.util.Event,
        DM  = YAHOO.widget.DateMath,
        Lang = YAHOO.lang,
        Selector = YAHOO.util.Selector,
      
      

     
     
        CLASS_DIARY                    = "yui-diary",
        CLASS_DIARY_ITEM_DETAILS       = "yui-diary-item-details",
        CLASS_DIARY_ITEM               = "yui-diary-item",
        CLASS_DIARY_DATACONTAINER      = "yui-diary-datacontainer",
        CLASS_DIARYDAY_CONTAINER       = "yui-diaryday-container",
        CLASS_DIARY_BACKGROUND         = "yui-diary-background",
        CLASS_DIARY_HOURBLOCK          = "yui-diary-hourblock",
        CLASS_DIARY_DAY                = "yui-diary-day",
        CLASS_DIARY_CONTAINER          = "yui-diary-container",
        CLASS_DIARY_TODAY              = "yui-diary-today",
        CLASS_DIARY_NAV                = "yui-diary-nav",
        CLASS_DIARY_TITLE              = "yui-diary-title",
        CLASS_DIARY_NAV_BUTTONS        = "yui-diary-nav-buttons",
        CLASS_DIARY_NAV_LEFT           = "yui-diary-nav-left",
        CLASS_DIARY_NAV_RIGHT          = "yui-diary-nav-right",
        CLASS_DIARY_NAV_TODAY          = "yui-diary-nav-today",
        CLASS_DIARY_NAV_CAL            = "yui-diary-nav-cal",
        CLASS_DIARY_NAV_CALBUTTON      = "yui-diary-nav-calbutton",
        CLASS_DIARY_NAV_VIEW           = "yui-diary-nav-view",
        CLASS_DIARY_COLLABEL_CONTAINER = "yui-diary-collabel-container",
        CLASS_DIARY_COLLABEL           = "yui-diary-collabel",
        CLASS_DIARY_ITEM_HIDDEN        = "yui-diary-item-hidden",
        CLASS_DIARY_SELECTOR           = "yui-diary-selector",
        CLASS_DIARY_LOADING            = "yui-diary-loading",
        CLASS_DIARY_LOADING_HIDDEN     = "yui-diary-loading-hidden",
        CLASS_DIARY_DISPLAY            = { MONTH: "yui-diary-view-month",
                                           WEEK:  "yui-diary-view-week",
                                           DAY:   "yui-diary-view-day",
                                           YEAR:  "yui-diary-view-year"},
        CLASS_DIARY_ITEM_MONTHVIEW     = "yui-diary-item-monthview",
        CLASS_DIARY_ITEM_YEARVIEW      = "yui-diary-item-yearview",
        CLASS_DIARY_MONTHLABEL         = "yui-diary-rowlabel-month",
        CLASS_DIARY_GOTO_WEEK          = "yui-diary-goto-weekview",
        CLASS_DIARY_FOOTER              = "ft",
        
        
        
        // valid fields that a DiaryItem can contain
        ITEM_FIELDS = ["UID", "DTSTART", "DTEND", "SUMMARY", "DESCRIPTION", 
                       "URL", "CATEGORIES", "LOCATION", "backClass", "detailClass"],
        
  /**
   *
   * <p>DiaryItem class for individual items in the Diary.</p>
   *
   * <p>Data and display for particular diary item.
   * Extends resize (and includes drag drop).  This class shouldn't be used
   * directly; items to be added should be added by the Diary.addItem() method.
   * </p>
   *
   * @class DiaryItem
   * @extends YAHOO.util.Resize
   * @param elContainer {HTMLElement | String} Container for the DiaryItem
   * @param oCfg {Object}  Object literal of configuration values.  oCfg.DTSTART and oCfg.DTEND are required.
   *
   */
  DiaryItem = function (el, oCfg) {

        // add some extra divs and things:
        this.initContent(el);
     
        oCfg.handles = [];
        if (oCfg.resizeTop) { 
            oCfg.handles.push("t"); 
        }
        if (oCfg.resizeBottom) { 
            oCfg.handles.push("b"); 
        }


        oCfg.draggable = false;
        oCfg.hiddenHandles = true;
        oCfg.proxy = false;
        oCfg.yTicks = parseInt(oCfg.pxPerHour / 4, 10);
        oCfg.status = false;


        // add a drag drop separately
        if (oCfg.enableDragDrop) {
            var dd = new YAHOO.util.DD(el, "default", {isTarget: false});
            this.dragdrop = dd;
        } else {
            this.dragdrop = false;
        }
     
     
        this._multiDayChildren = [];
        this._categories = [];
     
        YAHOO.log("constructor for new DiaryItem ", "info");     
     
        DiaryItem.superclass.constructor.call(this, el, oCfg);


     
        // default no animation initially
        this.anim = false;

     
        if (this.getDiary().get("display").format == "month") {
          this.addClass(CLASS_DIARY_ITEM_MONTHVIEW);
        } else if (this.getDiary().get("display").format == "year") {
          this.addClass(CLASS_DIARY_ITEM_YEARVIEW);
        } else if (this.dragdrop) {
            this.dragdrop.setYConstraint( 
                this.calculateTop(), 
                parseInt((24 * oCfg.pxPerHour ) - (this.calculateTop() / 3600), 10), 
                oCfg.yTicks 
            );
        }

        
        this.initListeners();


        
        return this;
    };



  /**
   * DiaryItem extends Resize:
   */
  Lang.extend(DiaryItem, YAHOO.util.Resize, {

      /**
       * String that separates hours and minutes
       * @property TIME_SEPARATOR 
       * @type {String}
       * @default ":"
       */
      TIME_SEPARATOR: ':',
      
      /**
       * What vertical line is this one in?
       * @property _line
       * @type Int
       * @private
       * @default 1
       */
      _line: 1,
      
      /**
       * Element holding the details
       * @property _detailsEl
       * @private
       * @default: null
       * @type HTMLElement
       */
      _detailsEl: null,
      
      /**
       * The YAHOO.util.DD instance.
       * We don't use the built-in one with Resize because some events don't
       * come through properly.
       * @property dragdrop
       * @type YAHOO.util.DragDrop
       * @default null
       */
      dragdrop: null,
      
      /**
       * For animating movement on drag drop
       * @property anim
       * @default: false
       * @type YAHOO.util.Anim
       */
      anim: false,
      
      /**
       * Remembers where we start from
       * @property _cacheDates
       * @private
       * @default: Array
       * @type Array
       */
      _cacheDates: {},
      

      
      
      /**
       * References to other elements in multi-day events
       * @property _multiDayChildren
       * @private
       * @default: []
       * @type Array
       */
      _multiDayChildren: [],
      
      
      /**
       * Array of categories, set by CATEGORIES method which parses the string
       * given in the config object.
       * @property _categories
       * @private
       * @default: []
       * @type Array
       */
      _categories: [],
      
      
      /**
       * Implementation of Element's abstract method. Sets up config values.
       *
       * @method initAttributes
       * @param oCfg {Object} Object literal definition of configuration values.
       * @private
       */
      initAttributes : function(oCfg){

         
         DiaryItem.superclass.initAttributes.call(this, oCfg);
         

         /**
          * @attribute UID
          * @description The unique id of the item.  Write once.
          * @default: ''
          */
         this.setAttributeConfig('UID', {
         
           value: '',
           writeOnce: true
         
         });
         
         /**
          * @attribute LOCATION
          * @descrition The location of the Item
          * @default: ''
          * @type String
          */
         this.setAttributeConfig('LOCATION', {
           value: '',
           validator: Lang.isString
         });
         
         
         
         /**
          * @attribute useCssCategories
          * @description If true, any CATEGORIES will be added as css classes
          * to the container element for the item, allowing styling and filtering.
          * Anything passed to backClass will also be added.  Spaces in categories
          * will be changed to hyphens.
          * @type Boolean
          * @default false
          */
         this.setAttributeConfig('useCssCategories', {
           validator: Lang.isBoolean,
           value: false
         });
         
         
         /**
          * @attribute CATEGORIES
          * @description Comma separated string of categories for this Item.  If
          * useCssCategories is true these will be added as css classes (with
          * hyphens replacing spaces.
          * @type String
          * @default ''
          */
         this.setAttributeConfig('CATEGORIES', {
           validator: Lang.isString,
           method: function(v) {
           
             var spaceToHyphen = function(str) {
               return Lang.trim(str).replace(/ /g, "-");
             },
                 cats = '',
                 i,
                 openQuote = false,
                 thisCategory = '';
           
             // if there are quotes in the string, we'll need to parse it carefully
             if (v.indexOf( '"' ) !== -1) {

                 for (i = 0; i < v.length; i++ ) {
                   
                   if (v[i] == '"') {

                       openQuote = !openQuote;
                       // end of a string
                       if (!openQuote) {
                         this._categories.push( spaceToHyphen(thisCategory) );
                         thisCategory = '';
                       } 
                   } else {
                       thisCategory += v[i];
                   }
                   
                 }
               
             } else if (v.indexOf(',')) {
               // multiple items: split them up and tidy them up
               cats = v.split(',');
               for (i = 0; i < cats.length; i++) {
                 cats[i] = spaceToHyphen(cats[i]);
               }
               this._categories = cats;
             } else {
               // just one category
               this._categories = [spaceToHyphen(v)];
             }
             
             
            // add categories as classes if needed:
            if (this.get("useCssCategories") && this._categories.length > 0) {
              Dom.addClass( this.get("element"), this._categories.join(" ") );
            }
            
           }
         });
         

         /**
          * @attribute SUMMARY
          * @description Summary text displayed on diary
          * @type String
          */
         this.setAttributeConfig('SUMMARY', {
         
           value: '',
           validator: Lang.isString
         
         });
         
         
         /**
          * @attribute DESCRIPTION
          * @description Full text displayed on diary 
          * @type String
          * @default ""
          */
         this.setAttributeConfig('DESCRIPTION', {
         
           value: '',
           validator: Lang.isString
         
         });

         /**
          * @attribute useAnimation
          * @description  Whether to use animation after drag drops
          * @type Boolean
          * @default false
          */
         this.setAttributeConfig('useAnimation', {
          
          value: false,
          validator: Lang.isBoolean
         
         }); 
         
         /**
          * @attribute backClass
          * @description Adds css class(es) to the background Item container
          * @type String class name to add
          * @default ""
          */
         this.setAttributeConfig('backClass', {
         
           value: '',
           validator: Lang.isString,
           method: function(v) {
               Dom.addClass(this.get("element"), v);
           }
         
         });
         
         /**
          * @attribute detailClass
          * @description Adds css class(es) to the text div container Item container
          * @type String class name to add
          * @default ""
          */         
         this.setAttributeConfig('detailClass', {
         
           value: '',
           validator: Lang.isString,
           method: function(v) {
                   Dom.addClass(this._detailsEl, v);
           }
         
         });



         /**
          * @attribute column
          * @description Reference to the column (ie day) this item is in
          * @type Object DiaryDay
          */
         this.setAttributeConfig('column', {
         
           value: null,
           validator: Lang.isObject
         
         });
         


         /**
          * @attribute block
          * @description Reference to the block (ie group of items) this item is in
          * @type Object DiaryBlock
          */
         this.setAttributeConfig('block', {
         
           value: null,
           validator: Lang.isObject
         
         });


         
         /**
          * @attribute multiDayPosition
          * @description Where this item falls if it's a multi-day event
          * @type False | String      May be "first", "last", or "mid"
          * @private
          */
         this.setAttributeConfig('multiDayPosition', {

           value: false
         
         });


         
         /**
          * @attribute multiDayParent
          * @description parent DiaryItem for multi-day events
          * @type DiaryItem
          * @private
          */
         this.setAttributeConfig('multiDayParent', {

           value: false
         
         });
         
         
         /**
          * @attribute DTSTART
          * @description Start time/ date
          * @type Object Date object
          */
         this.setAttributeConfig('DTSTART', {
         
           setter: function(v){
             this.set("_displayDTSTART", v);
             return v;
           }
         
         });
         
         /**
          * @attribute _displayDTSTART
          * @descripiton Start time as displayed - may be different to DTSTART for multi-day items
          * @private
          * @type Object Date object
          */
         this.setAttributeConfig('_displayDTSTART');
         
         
         /**
          * @attribute DTEND
          * @description End time/ date
          * @type Object Date object
          */
         this.setAttributeConfig('DTEND', {
         
           setter: function(v) {
             this.set("_displayDTEND" , v );
             return v;
           }
         });
         


         /**
          * @attribute _displayDTEND
          * @descripiton Start time as displayed - may be different to DTEND for multi-day items
          * @private
          * @type Object Date object
          */
         this.setAttributeConfig('_displayDTEND');
         
         
         
         /**
          * @attribute URL
          * @description URL data for item
          * @type String
          */
         this.setAttributeConfig('URL', {
         
           validator: Lang.isString
         
         });
         

          /**
           * @attribute pxPerHour
           * @description  Number of pixels per hour
           * @default: 20
           * @type Number
           */ 
           this.setAttributeConfig( "pxPerHour", {
             validator: Lang.isNumber,
             value: 20
           });    





          /**
           * @attribute visible
           * @description  Whether this should be displayed or not
           * @default: 20
           * @type Number
           */ 
           this.setAttributeConfig( "visible", {
             validator: Lang.isBoolean,
             value:true,
             method: function(v) {
               if (!v) {
                 this.addClass(CLASS_DIARY_ITEM_HIDDEN);
               }
             }
           });    
     
         
      },
      
      




      /**
       * @description Initializer, sets up the details Element
       * @protected
       * @method initContent
       * @param el {HTMLElement|String} Element passed to constructor
       */
      initContent: function(el) {

        var detailsEl = document.createElement("div");
            
        // add some classes
        Dom.addClass(detailsEl, CLASS_DIARY_ITEM_DETAILS );
        el.appendChild(detailsEl);

        this._detailsEl = detailsEl;
      
      },
      
      
      
      /**
       *
       * @description Initialize listeners for this item.
       * @protected
       * @method initListeners
       */
      initListeners: function() {

        this.on("startResize",this._handleBeforeStartDrag, "resize", this);
        this.on("startResize", this._handleDiaryStartDrag, "resize", this);
        this.on("endResize", this._handleDiaryEndDrag, "resize", this);
        this.on("resize", this._handleDiaryDragOver, this, true);

        this.on("SUMMARYChange", this.renderDetails , this, true);
        this.on("DTSTARTChange", this.renderDetails, this, true);
        this.on("DTENDChange", this.renderDetails, this, true);
       
        if (this.dragdrop) {
          this.dragdrop.on("b4StartDragEvent" , this._handleBeforeStartDrag, "drag", this);
          this.dragdrop.on("startDragEvent", this._handleDiaryStartDrag, "drag", this);
          this.dragdrop.on("endDragEvent", this._handleDiaryEndDrag, "drag", this);
          this.dragdrop.on("dragEnterEvent", this._handleDiaryDragEnter, this, true);
          this.dragdrop.on("dragOverEvent" , this._handleDiaryDragOver , this, true);
        }
      },
      
      
      /**
       * @description Fires an event and stops the drag if subscriber returns false
       * @method _handleBeforeStartDrag
       * @param ev {HTMLEvent} The before start drag event
       * @protected
       */
      _handleBeforeStartDrag: function(ev, type) {

        var that = this,
            stopDrag = function () {
               YAHOO.util.DDM.stopDrag();
               YAHOO.util.DDM.stopEvent();
               Ev.stopEvent(ev);
               if (that._cacheDates.diaryDisplay.format == "month") {
                  that.addClass(CLASS_DIARY_ITEM_MONTHVIEW);
                  that.setStyle("position", "relative");
               } else if (that._cacheDates.diaryDisplay.format == "year") {
                  that.addClass(CLASS_DIARY_ITEM_YEARVIEW);
                  that.setStyle("position", "relative");                 
               }
               
               return false;       
            };

 
        this._cacheDates = {
           startTimeDay: this.getStartTimeDay(),
           DTSTART: new Date(this.get("DTSTART")),
           DTEND: new Date(this.get("DTEND")),
           diaryDisplay: this.getDiary().get("display")
        };


        if ((type == "resize" && this._locked) ||
            (type == "drag" && this.dragdrop.locked)) {
          return stopDrag();
        }

        /**
         * @event itemBeforeStartMove
         * @description Fired before everything starts moving.  Return false to cancel move.
         * @param oArgs.item   DiaryItem that's about to be moved.
         * @param oArgs.originEvent   Original event from resize/dragdrop passed through.
         */
        if (false === this.getDiary().fireEvent("itemBeforeStartMove", {item: this, originEvent: ev})) {
           return stopDrag();
        }
        
        if (this._cacheDates.diaryDisplay.format == "month" || this._cacheDates.diaryDisplay.format == "year") {
          this.removeClass(CLASS_DIARY_ITEM_MONTHVIEW);
          this.removeClass(CLASS_DIARY_ITEM_YEARVIEW);
          this.setStyle("position", "absolute");
          Dom.setStyle(Dom.getAncestorByClassName(this.get("element"),CLASS_DIARYDAY_CONTAINER), "overflow", "visible");
        }
        
        
      },
      
      
      /**
       * Start dragging handler.  Caches dates, sets Anim if needed.
       * @method _handleDiaryStartDrag
       * @protected       
       */
      _handleDiaryStartDrag: function (ev, type) {

        if ((type == "resize" && this._locked) ||
            (type == "drag" && this.dragdrop.locked)) { 
          return false;
        }
        
        Dom.setStyle(this.get("element"), "z-index", 2);

        if (YAHOO.util.Anim !== undefined && 
            this.anim === false && 
            this.get("useAnimation") === true) {
           
              this.anim = new YAHOO.util.Anim(this.get("element"), {}, 0.5);
              
        }
      },
      
      
      /**
       * While entering a day, update this item's current day
       * @method _handleDiaryDragEnter
       * @param ev {Event}
       * @param String   Id passed by dragenter event
       * @protected
       */
      _handleDiaryDragEnter: function(ev ,id) {
      
   
         YAHOO.log(" DiaryItem._handleDiaryDragOver ", "info"); 
         var dayTarget = YAHOO.util.DDM.getDDById(ev.info)._diaryDay.get("coldate");

       
         this.setStartTimeDay(dayTarget);
         this.setEndTimeDay(dayTarget);
         

      },


      
      
      /**
       * While dragging over a day, update this item's current time and display it
       * @method _handleDiaryDragOver
       * @param ev Event
       * @protected
       */      
      _handleDiaryDragOver: function(ev) {

        var mdp;
        
        if (this._cacheDates.diaryDisplay.format == "month" || this._cacheDates.diaryDisplay.format == "year") {
          return;
        }
        
        mdp = this.get( "multiDayPosition" );
          
        // change the start times if this is a one-day item, 
        //or the start of a multi-day item
        if ( mdp === false || mdp == "first") {
              
              this.getParentItem().setStartTimeSecs(this.calcStartFromPosition());
              
        }
        // change the end times if this is a one-day item, or the end of a multi-day item
        if (mdp === false || mdp == "last") {
              this.getParentItem().setEndTimeSecs(this.calcEndFromPosition());
        }
        
        // redisplay times
        this.renderDetails(true);
        
      },
      
      
      /**
       * At the end, update times and days and re-render
       * @method _handleDiaryEndDrag
       * @param ev Event
       * @protected
       */
      _handleDiaryEndDrag: function(ev, type, silent) {
      

        var startTimeDay, element, endCol, el,
            startCol = this.get("column"),
            diary = this.getDiary(),
            cache = this._cacheDates,
            cacheStart = cache.DTSTART ,
            cacheEnd   = cache.DTEND,
            beforeEvent = true,
            multiDayPos,
            silent = silent || false;
      
        

        /**
         * @event itemBeforeEndMove
         * @description fired when an item is moved or resized (ie the times change).
         * Return false to cancel the resize/move
         * @param oArgs.from   Object literal containing original DTSTART and DTEND
         * @param oArgs.to     Object literal containing final DTSTART and DTEND
         * @param oArgs.item   DiaryItem that's being moved
         * @param oArgs.originEvent    Original event from resize/dragdrop passed through.
         */
         if (!silent) {
          beforeEvent = diary.fireEvent("itemBeforeEndMove", { 
                  from : { DTSTART: cacheStart , 
                           DTEND : cacheEnd 
                  },
                  to: { DTSTART: this.get( "DTSTART" ),
                        DTEND  : this.get( "DTEND" ) 
                  }, 
                  item: this,
                  originEvent: ev 
              }); 
        }
        
        if((type == "resize" && this._locked) ||
           (type == "drag" && this.dragdrop.locked) ||
           (false === beforeEvent)) {
         
             // reset dates to where they started from:
             this.set( "DTSTART" , cacheStart );
             this.set( "DTEND", cacheEnd );
             // and tidy up:
             if (cache.diaryDisplay.format == "month") {
                this.addClass(CLASS_DIARY_ITEM_MONTHVIEW);
                this.setStyle("position", "relative");
                Dom.setStyle(Dom.getAncestorByClassName(this.get("element"),CLASS_DIARYDAY_CONTAINER), "overflow", "auto");
             } else if ( cache.diaryDisplay.format == "year") {
                this.addClass(CLASS_DIARY_ITEM_YEARVIEW);
                this.setStyle("position", "relative");
                Dom.setStyle(Dom.getAncestorByClassName(this.get("element"),CLASS_DIARYDAY_CONTAINER), "overflow", "auto");
             }

             this._cacheDates = {};
             Dom.setStyle( element , "z-index" , 1 );
             return false;
                     
        } else {
        
            if (!this.dragdrop.locked) {
              this.dragdrop.lock();
            }
            
            if (this._cacheDates.diaryDisplay.format != "month" && this._cacheDates.diaryDisplay.format != "year") {
                // change the times
                multiDayPos = this.get( "multiDayPosition" );
                if (multiDayPos === false || multiDayPos == "first") {
                  this.getParentItem().setStartTimeSecs( this.calcStartFromPosition() );
                }
                if (multiDayPos === false || multiDayPos == "last") {
                  this.getParentItem().setEndTimeSecs( this.calcEndFromPosition() );
                }
            }
          
            startTimeDay = this.getStartTimeDay();
            element = this.get("element");
          
            // remove the node from the current col and stick it in the new one
            // and then re-render the start and end columns
            if( cache.startTimeDay !== startTimeDay ){
    
              endCol   = diary.getDiaryDay( startTimeDay );
              el       = element.parentNode.removeChild( element );

              
              startCol.removeItemFromBlock( this );  
              endCol._dataEl.appendChild( el );
              
              endCol._addItemToBlock( this );
              
              this.set("column", endCol );
      
              startCol._rebuildBlocks();
              startCol._renderBlocks();
              
              startCol = this.get("column");
              
              
            }
   
        }


        // startCol may be where we ended up (not started)
        startCol._rebuildBlocks();
        startCol._renderBlocks();
 
 
        /**
         * @event itemEndMove
         * @description fired when an item is moved or resized (ie the times change)
         * @param oArgs.from   Object literal containing original DTSTART and DTEND
         * @param oArgs.to     Object literal containing final DTSTART and DTEND
         * @param oArgs.item   DiaryItem that's being moved
         * @param oArgs.originEvent    Original event from resize/dragdrop passed through.
         */
        if (!silent) {
          diary.fireEvent( "itemEndMove" , { 
              from : { DTSTART: cacheStart , 
                       DTEND : cacheEnd 
              },
              to: { DTSTART: this.get( "DTSTART" ),
                    DTEND  : this.get( "DTEND" ) 
              }, 
              item: this,
              originEvent: ev } 
          );
        }
        
        // final tidying up
         if (cache.diaryDisplay.format == "month") {
            this.addClass(CLASS_DIARY_ITEM_MONTHVIEW);
            this.setStyle("position", "relative");
            Dom.setStyle(Dom.getAncestorByClassName(this.get("element"),CLASS_DIARYDAY_CONTAINER), "overflow", "auto");
         } else if (cache.diaryDisplay.format == "year") {
            this.addClass(CLASS_DIARY_ITEM_YEARVIEW);
            this.setStyle("position", "relative");
            Dom.setStyle(Dom.getAncestorByClassName(this.get("element"),CLASS_DIARYDAY_CONTAINER), "overflow", "auto");
         }
        this._cacheDates = {};
        
        if (!this.getDiary()._lockDragDrop) {
          this.dragdrop.unlock();
        }
        
        Dom.setStyle( element , "z-index" , 1 );
      },
      
      
      /**
       * @method getDiary
       * @description Returns Diary instance we're in.
       * @return {YAHOO.widget.Diary}
       */
      getDiary: function(){
        return this.get("column").get("diary");
      },



      /**
       * @method hasCategory
       * @description Checks if Item has category passed.
       * @param category {String} Category string to check
       * @param caseSensitive {Boolean} Whether to do case-sensitive match 
       * (default false)
       * @return {Boolean}
       */
      hasCategory : function (category, caseSensitive) {
      
        var i,
            cats = this._categories,
            categoryLC = category.toLowerCase(),
            matchFn = (caseSensitive === true ?
                       function (a) { return (a === category);} :
                       function (a) { return (a.toLowerCase() === categoryLC);});
            
        for (i = 0; i < cats.length; i++) {
        
          if (matchFn(cats[i])) {
            return true;
          }
        
        }
       
      },
      
      
      /**
       * @method addCategory
       * @description Adds a category to the existing ones, if it's not there
       * already (using default case insensitive match
       * @param category {String} Category string to check
       * @param caseSensitive {Boolean} Whether to do case-sensitive match 
       */
      addCategory : function (category, caseSensitive) {
        if (!this.hasCategory(category, caseSensitive)) {
          this.set("CATEGORIES", this.get("CATEGORIES") + "," + category);
        }
      },

      
      /**
       * @method setStartTimeDay
       * @description Sets the start day/month/year of this item (but not times)
       * @param {Object} Date to extract date/month/year from
       */
      setStartTimeDay: function ( date ) {
        var start = this.get("DTSTART");
        start.setYear( date.getFullYear() );
        start.setMonth( date.getMonth() );
        start.setDate( date.getDate() );

      },


      /**
       * @method setEndTimeDay
       * @description Sets the end day/month/year of this item
       * @param {Object} Date to extract date/month/year from
       */      
      setEndTimeDay: function ( date ) {
        var end = this.get("DTEND");
        end.setYear( date.getFullYear() );  
        end.setMonth( date.getMonth() );
        end.setDate( date.getDate() );
            
      },

      /**
       * @method getStartTimeDay
       * @description Gets the start time ( milliseconds) of the day of this item (ie at 00:00)
       * @return {Int}
       */      
      getStartTimeDay: function () {
        return ( this.get("DTSTART").getTime() - (this.getStartTimeSecs()*1000) );
      },
      
      
      /**
       * @method getStartTimeSecs
       * @description Gets the start time as seconds from 00:00
       * @return {Int}
       */
      getStartTimeSecs: function(){
        var s = this.get("DTSTART");
         return (s.getHours() * 3600) + (s.getMinutes() * 60) + s.getSeconds();
      },
      
      
      /**
       * @method getEndTimeSecs
       * @description Gets the end time as seconds from 00:00
       * @return {Int}
       */
      getEndTimeSecs: function(){
        var e = this.get("DTEND");
        return (e.getHours() * 3600) + (e.getMinutes() * 60) + e.getSeconds();
      },


      
      
      /**
       * @method getDisplayStartTimeSecs
       * @description Gets the displayed start time as seconds from 00:00
       * @protected
       * @return {Int}
       */
      getDisplayStartTimeSecs: function(){
        var s = this.get( "_displayDTSTART" );
        return (s.getHours() * 3600) + (s.getMinutes() * 60) + s.getSeconds();
      },
      
      
      /**
       * @method getDisplayEndTimeSecs
       * @description  Gets the displayed end time as seconds from 00:00
       * @protected
       * @return {Int}
       */
      getDisplayEndTimeSecs: function(){
        var e = this.get( "_displayDTEND" );
        return (e.getHours() * 3600 ) + (e.getMinutes() * 60) + e.getSeconds();
      },
      
      
            
      /**
       * @method setStartTimeSecs
       * @description  Sets the start time (but not date) from seconds
       * @param Int
       */      
      setStartTimeSecs: function( secs ) {
         var h = Math.floor( secs / 3600 ),
             m = Math.floor( (secs - ( h * 3600 ) ) / 60 );
        
         this.get("DTSTART").setHours( h , (m - m%15) );
      
      },
 
 
 
 
      
      /**
       * @method setEndTimeSecs
       * @description  Sets the end time (but not date) from seconds
       * @param Int
       */          
      setEndTimeSecs: function( secs ) {
         var h = Math.floor( secs / 3600 ),
             m = Math.floor( (secs - ( h * 3600 ) ) / 60 );
        
         if( m%15 < 8 ){
           m = m - m%15;
         } else {
           m = m + ( 15 - m%15 );
         }
            
         this.get("DTEND").setHours( h , m );      
      },
      
      
      /**
       * @method calculateHeight
       * @description Calculate the height (in pixels) of this based on times
       * @return {Int}
       */
      calculateHeight: function(){
      
        return ( ( this.getDisplayEndTimeSecs() - this.getDisplayStartTimeSecs() ) * ( this.get("pxPerHour") /3600)  - 2);
      
      },

      /**
       * @method calculateTop
       * @description Calculate the top (in pixels) of this based on times
       * @return {Int}
       */      
      calculateTop: function(){
        return ( ( this.getDisplayStartTimeSecs() ) * ( this.get("pxPerHour") / 3600) );
      },

      /**
       * @method calcStartFromPosition
       * @description Calculate the start time (seconds) based on position
       * @return {Int}
       */      
      calcStartFromPosition: function( t, pxPerHour) {
         if( t === undefined ) {
           t = parseInt( this.getStyle("top") , 10 );
         }
         if(pxPerHour === undefined) {
           pxPerHour = this.get("pxPerHour");
         }
         return parseInt( ( ( t * 3600 ) / pxPerHour), 10 );
      
      },

      /**
       * @method calcEndFromPosition
       * @description Calculate the end time (seconds) based on position
       * @return {Int}
       */        
      calcEndFromPosition: function( h , t, pxPerHour) {
      
         if( h === undefined ){
           h = parseInt(this.getStyle("height"),10);
         }
         if( t === undefined ) {
           t = parseInt( this.getStyle("top") , 10 );
         }
         if(pxPerHour === undefined) {
           pxPerHour = this.get("pxPerHour");
         }      
         return parseInt( ( ( ( h + t ) * 3600 ) / pxPerHour), 10 );
      
      },




      /**
       * @method renderStartTime
       * @description Gets start time as string hh:mm format
       * @return {String}
       */
      renderStartTime: function(){
        var s = this.get( "DTSTART" ),
            h = (s ? s.getHours() : 0 ),
            m = (s ? s.getMinutes() : 0 );
        return ( h < 10 ? '0' : '' ) + h + this.TIME_SEPARATOR + ( m < 10 ? '0' : '' ) + m ;
      },
      
      /**
       * @method renderEndTime
       * @description Gets end time as string
       * @return {String}
       */      
      renderEndTime: function(){
        var s = this.get( "DTEND" ),
            h = (s ? s.getHours() : 0 ),
            m = (s ? s.getMinutes() : 0 );
        return ( h < 10 ? '0' : '' ) + h + this.TIME_SEPARATOR + ( m < 10 ? '0' : '' ) + m ;

      
      },
      
      /**
       * @method render
       * @description Render the item
       * @param Object Containing some dimensions { width: Int, linesInBlock: Int}
       */          
      render: function( oDetails ) {

        YAHOO.log( "DiaryItem.render()", "info");


        // set the offset and width
        var lineWidth,
            w,
            l,
            t,
            h;
        
        if (!oDetails) {
          oDetails = { 
             linesInBlock: this.get("block").getVisibleLines(),
             width: this.get("column").get("width") || 150 
          };
        }

            
        if (this.getDiary().get("display").format == "month") {
            w = oDetails.width - 20;
            l = 10;
            t = 0;
            h = 20;
            this.setStyle("position", "relative");
        } else if (this.getDiary().get("display").format == "year") {
            w = Math.max(oDetails.width - 20, 10);
            l = 2;
            t = false;
            h = 5;
        } else {
            lineWidth = parseInt(((oDetails.width  - 20 )/ Math.max(1,oDetails.linesInBlock)), 10);
            w = (lineWidth - 4 );
            l =  parseInt((( this.get("block").getOffset(this._line)) * lineWidth ) + 20 , 10 );
            t = parseInt( this.calculateTop() , 10 );
            h = parseInt( this.calculateHeight() , 10 );
        }
             
        this.renderDetails( false );
        
        
        if ( t>= 0) {
          this.setStyle( "top" , t + "px");
        }
        this.setStyle( "left" , l + "px" );
        
        if( this.anim === false ) {
          this.setStyle( "width" , w + "px" );
          this.setStyle( "height" , h + "px");
          Dom.setStyle( this._detailsEl, "height", h + "px");

        } else {
          this.anim.attributes = {  height: { to: h }, width: { to : w } };
          this.anim.animate();
        }
        this.addClass( CLASS_DIARY_ITEM );


      },
      
      
      /**
       * @method renderDetails
       * @description Writes the text to the this._detailsEl element
       * @param {Boolean} Whether to use the item's parent (if a multi-day item)
       */
      renderDetails: function( useParent ){

        var i, item = ( useParent ? this.getParentItem() : this ), shortText;
        
        if( item === this ){

          for( i =0; i < this._multiDayChildren.length; i++ ){
            this._multiDayChildren[ i ].renderDetails( );
          }
        
        } else {
        
          item.renderDetails();
        
        }
        // put the actual details
        shortText =  item.renderStartTime() + ' - ' + item.renderEndTime() + ': ' + item.get("SUMMARY") ; 

        this._detailsEl.innerHTML = shortText;
        this._detailsEl.title = shortText;


      },
      
      
      /**
       * @method renderFullDetails
       * @description Returns a string showing full details of the item.
       * @return {String}
       */
      renderFullDetails: function(){
 
        var item = this.getParentItem(),
        // put the actual details
            shortText =  item.renderStartTime() + ' - ' + item.renderEndTime() + ': ' + item.get("SUMMARY");
        
        shortText += "<br/>" + item.get("DESCRIPTION");
        
        return shortText;

      },      
      
      /**
       * @method setLine
       * @description Which 'line' (ie what offset) is this one in?
       * @param Int
       */
      setLine: function( line ) {
        this._line = line;
      },
      
      
      /**
       * @method addMultiDayChild
       * @description Adds a linked child diary item to the stack:
       * @param oDiaryItem {DiaryItem}
       */
      addMultiDayChild: function( oDiaryItem ){
         this._multiDayChildren.push( oDiaryItem ); 
      },


      
      /**
       * @method getParentItem
       * @description Provides access to the parent item.  For single-day events, it's this,
       * for multi-day events it's the parent, which will give proper dates/times etc
       * and ids for editing and so on.
       * @return {DiaryItem}
       */
      getParentItem: function(){
        if( this.get("multiDayParent") ){
          return this.get("multiDayParent");
        }
        return this;
      },
      
      
      /**
       * @method destroy
       * @description Destroys the DiaryItem
       */
      destroy : function() {

        var i = 0, 
            numChildren = this._multiDayChildren.length,
            el = this.get("element"),
            parent = el.parentNode;
      
        if (this.dragdrop) {
          this.dragdrop.unreg();
          delete this.dragdrop;
        }

        if (Lang.isObject(this._dds)) {
          if (Lang.hasOwnProperty(this._dds, "b")) {
            this._dds.b.unreg();
          }
          if (Lang.hasOwnProperty(this._dds, "t")) {
            this._dds.t.unreg();
          }
        }
        

        this._line = null;
        this._detailsEl = null;
        if (this.anim !== false) {
          this.anim.destroy();
          this.anim = false;
        }
        this._cacheDates = null;

        if (numChildren> 0) {
          for (i = 0; i < numChildren; i++) {
            if (Lang.hasOwnProperty(this._multiDayChildren[i], "destroy")) {
               this._multiDayChildren[i].destroy();
            }
          }
        }
        this._multiDayChildren = null;
        
        DiaryItem.superclass.destroy.call(this);
        
        if (parent) {
          parent.removeChild(el);
        }
        
        /**
         * @event destroy
         * @description Fired after destruction process
         */
        this.fireEvent("destroy");
      
      }
  
  });  
  
  
  
  
  
  /**
   *
   * A block of diary items.
   * Holds diary items that overlap in time within a single day.  You won't want
   * to deal with these directly.
   *
   * @class DiaryBlock 
   *
   */
  var DiaryBlock = function( ){
      YAHOO.log( "new DiaryBlock called" , "info" );
      this.init();
  };
  

  DiaryBlock.prototype = {
  
    /**
     * Array of DiaryItem in this block.
     * @property _items
     * @type Array
     * @default []
     * @protected
     */
    _items:[],
    
    /**
     * Time of day, in seconds of the start of this block.
     * @property _startSecs
     * @type Int
     * @default 86401
     * @protected
     */
    _startSecs: 86401,

    /**
     * Time, in seconds, of the end of this block.
     * @property _endSecs
     * @type Int
     * @default -1
     * @protected
     */
     
    _endSecs: -1,

    /**
     * The number of vertical lines in the block.
     * Array holding an objects for each line, of the form
     * { startSecs: 123, endSecs: 456 , visible: true }
     * @property _lines
     * @type Array
     * @default []
     * @protected
     */
    _lines: [],



    /**
     * @method init
     * @description Initializer function.
     * @protected
     */
    init: function(){
      this._items = [];
      this._startSecs = 86401;
      this._endSecs = -1;
      this._lines = [];
    },
  
    /**
     * Adds a DiaryItem to the block.
     * @method addItem
     * @param item {DiaryItem}
     */
    addItem: function(item) {
    
      // which vertical line will this sit in?
      var line = this._findLineForItem(item);
      // add a new one if needed
      if( line === false ) {
        this._lines.push({startSecs: item.getDisplayStartTimeSecs(),
                          endSecs : item.getDisplayEndTimeSecs(),
                          visible: item.get("visible")});
        line = this._lines.length - 1;
      } else {
        this._lines[line].startSecs = Math.min(this._lines[line].startSecs, 
                                               item.getDisplayStartTimeSecs());
        this._lines[line].endSecs = Math.max(this._lines[line].endSecs, 
                                             item.getDisplayEndTimeSecs());
        this._lines[line].visible = item.get("visible") || this._lines[line].visible;

      }
      item.setLine( line );
    
      // store the item
      this._items.push( item );
      item.set("block", this);
      
      this._items.sort( function( a,b ){ return ( a.startSecs < b.startSecs ); } );
      
      
      // update min/max times
      this._startSecs = Math.min( this._startSecs, item.getDisplayStartTimeSecs() );
      this._endSecs   = Math.max( this._endSecs, item.getDisplayEndTimeSecs() );
  
    },
    
    /**
     * @method removeItem
     * @description Removes an item from the block
     * @param {DiaryItem}  DiaryItem to remove
     * @return {Boolean}  True if removed, false if not found
     */
    removeItem: function( item ) {
       var i, allItems = this._items;
       
       for( i = 0; i < allItems.length ; i++ ){

        if( allItems[ i ].get("id") == item.get("id") ) {
          allItems.splice( i, 1 );
          item.set("block", null);
          return true;
        }
      }
      return false;
    
    },
    
    
    
    /**
     * @method _findLineForItem
     * @description  Will the item fit in an existing vertical line?
     * @return {Int} || {False}  - line number 
     * @protected
     * @param {DiaryItem}
     */
    _findLineForItem: function( item ) {
    
      var i, 
          lines = this._lines;
      
      // will it fit in this line?
      for( i = 0; i < lines.length; i++ ) {
        
         if( item.getDisplayEndTimeSecs() <= lines[ i ].startSecs || item.getDisplayStartTimeSecs() >= lines[ i ].endSecs ){
         
           return i;
         
         }
        
      }
      
      return false;
    
    },
    
    
    /**
     * @method contains
     * @description  Does item overlap with this block?
     * @param item {DiaryItem}
     * @return {Boolean}
     */
    contains: function(item) {
      // starts before the end of the block, or ends after the start of the block:
      return item.getDisplayStartTimeSecs() < this._endSecs && item.getDisplayEndTimeSecs() > this._startSecs;
    },

    /**
     * @method render
     * @description  Renders the DiaryItems in the block
     * @param Object   Literal containing width property of entire column
     * @return {Boolean}
     */    
    render: function( oCfg ){
      var i, 
          numVisibleLines = this.getVisibleLines();
      
      for( i = 0; i < this._items.length; i++ ) {
        this._items[ i ].render( {linesInBlock: numVisibleLines,
                                  width: oCfg.width || 150 });
      }
    },
    
    
    
    getVisibleLines : function() {
      var i, numVisibleLines = 0;
      
      for (i = 0; i < this._lines.length; i++) {
        if (this._lines[i].visible) {
          numVisibleLines ++;
        }
      }
      return numVisibleLines;
    },
    



    /**
     * @method getOffset
     * @description Gives the number of visible lines across the line passed is
     */
    getOffset : function(line) {
      
      var i, visibleLine = 0;
      
      for (i = 0; i < this._lines.length; i++) {
        if (this._lines[i].visible) {
          
          if (i == line) {
            return visibleLine;
          }
          
          visibleLine ++;
          
        }
      }
      return 0;     
      
    },
    
        
    
    /**
     * @method toString
     * @return {String}
     */
    toString: function(){
      return "DiaryBlock";
    },
    
    /**
     * @method destroy
     */
    destroy: function() {
      this.init();
    }
  
  };
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  /**
   *
   * A days worth of diary items. Contains none or more DiaryBlocks.
   * @class DiaryDay
   * @param {HTMLElement || String} Html element to render to
   * @param Object   Configuration object literal
   * @extends YAHOO.util.Element
   *
   */
  var DiaryDay = function( el, oCfg ){

    DiaryDay.superclass.constructor.call( this, el, oCfg);
    this._blocks = [];
    
    // Add some elements
    var dataEl = document.createElement( "div" );
    Dom.addClass( dataEl , CLASS_DIARY_DATACONTAINER );
    this.get("element").appendChild( dataEl );
    this._dataEl = dataEl;

    var backgroundEl = document.createElement( "div" );
    backgroundEl.id = "bdy-" + el.id.substring( 4 );
    this.get("element").appendChild( backgroundEl );
    this._backgroundEl = backgroundEl;
    
    if (this.get("coldate").getTime() === new Date().setHours(0,0,0,0)) {
       this.addClass(CLASS_DIARY_TODAY);
    }


    // Make the background a DDTarget
    var ddt = new YAHOO.util.DDTarget( backgroundEl , "default" );
    
    // Store a ref to this day so we know on drag drop where we are easily
    ddt._diaryDay = this;
    this.ddTarget = ddt;
    
    // render the columns
    this._renderColumn();
  };
  

  DiaryDay.prototype.toString =  function(){
       return "DiaryDay for " + this.get("coldate").toString();
  };

  
  
  
  
  Lang.extend( DiaryDay, YAHOO.util.Element, {


      
      /**
       * @method initAttributes
       * @param oCfg {Object} Object literal of config values
       * @private
       */
      initAttributes: function( oCfg ){

         DiaryDay.superclass.initAttributes.call( this, oCfg );
         
         /**
          * @attribute diary
          * @type YAHOO.util.Diary
          * @description reference to the Diary object holding this DiayDay
          * 
          */
         this.setAttributeConfig( 'diary' );

         /**
          * @attribute coldate
          * @type {Object} 
          * @description Date object for this column
          * 
          */
         this.setAttributeConfig( 'coldate' );
         
         
         /**
          * @attribute width
          * @type {Int}
          * @default 150
          * @description Width of the column (as an integer) in pixels.
          */
         this.setAttributeConfig( "width" , {
           method: function(v){
             Dom.setStyle( this.get("element"), "width" , v + "px" );
           },
           value : 150
          }
         );

     
      },


     /**
      * 
      * @property _blocks
      * @description Holds blocks of items
      * @type Array
      * @protected
      */
     _blocks: [],

     /**
      * 
      * @property _dataEl
      * @description HTMLElement holding the HTMLElements for the DiaryItems
      * @type HTMLElement
      * @protected
      */     
     _dataEl: null,
     
  
     /**
      * @method addItem
      * @description Adds the item to the day
      * @param {Object}  Object literal of data for the new DiaryItem
      * @return {Object} DiaryItem
      */
     addItem: function( oData ) {
     
       YAHOO.log( "DiaryDay.addItem ","info" );
       var item, itemEl;
       
         // create an element for the new item
         itemEl = document.createElement( "div" );
         this._dataEl.appendChild( itemEl );
         
         // set the column of the new item
         oData.column = this;

         item = new DiaryItem( itemEl, oData );

         // Work out how this new item fits among the other existing ones
         this._addItemToBlock( item );
           
         return item;
  
     },


     /**
      * @method _addItemToBlock
      * @description Works out which of existing blocks to add this item to, or
      * create a new block if needed.
      * @param {Object}  DiaryItem
      * @protected
      */     
     _addItemToBlock: function (item) {
       
       var i;
       
       // see if item fits in existing blocks:
       for( i = 0; i < this._blocks.length ; i++ ) {
         
         if( this._blocks[ i ].contains( item ) ){
           this._blocks[ i ].addItem( item );
           return;
         }
         
       }
       
       // if not, create a new one
       var newBlock = new DiaryBlock();
       newBlock.addItem( item );
       this._blocks.push( newBlock );
     
     },
     
     
     /**
      * @method removeItemFromBlock
      * @description Removes an item from its block
      * @param item {DiaryItem}
      * @return {Boolean}  Whether it was successfully removed
      */
     removeItemFromBlock: function( item ){
       
       var i, blocks = this._blocks;

       for( i = 0 ; i < blocks.length; i ++ ){
         if( blocks[i].removeItem( item ) ){
           return true;
         }
       }
       
       return false;
       
     },
     
     
     /**
      * @method _rebuildBlocks
      * @description Gets current items and rebuilds blocks in case some have changed.
      * @protected
      */
     _rebuildBlocks: function(){
         
         YAHOO.log("rebuilding", "info");     
         var i, j, allItems = [];
       
         // Get the existing items into a temp array and get rid of the blocks
         for( i = 0; i < this._blocks.length; i++ ){
         
           for( j = 0; j < this._blocks[ i ]._items.length; j++ ) {
  
              allItems.push( this._blocks[ i ]._items[ j ] );
           
           }
           
           this._blocks[ i ].destroy();
  
         }
         this._blocks = [];
        
         // Sort the items
         allItems.sort(this.get("diary")._itemSorter);
         
         // Re-add the items
         for( i = 0; i < allItems.length; i++ ) {
           this._addItemToBlock( allItems[ i ] );
         }

     
     },
     
     
     /**
      * @method render
      * @description Renders the day view.
      */
     render: function() {
       
       // render the columns
       //this._renderColumn();
       
       // render each block
       this._renderBlocks();

     },



     /**
      * @method _renderColumn
      * @description Draws a column for the day
      * @protected
      */
     _renderColumn: function(){
        
        YAHOO.log( "renderColumn" , "info" );
        
        var h,    // hour counter
            parent = this.get("element"),
            newEl,
            coldate = this.get("coldate"),
            dateFormat = "%e",
            backgroundEl = this._backgroundEl,
            containerEl = document.createElement( "div" ),
            baseEl = document.createElement( "div" );
        
        // container:
        Dom.addClass(containerEl, CLASS_DIARYDAY_CONTAINER);
        Dom.setStyle(containerEl, "line-height", null);
        
        // container for background:
        Dom.addClass(backgroundEl, CLASS_DIARY_BACKGROUND);
       
       
        if (this.get("diary").get("display").format == "month") {
        
           
           if (coldate.getDay() == 1 || coldate.getDate() == 1) {
             dateFormat += " %b";
             if (coldate.getMonth() === 0) {
               dateFormat += ", %Y";
             }
           }
           baseEl.innerHTML = YAHOO.util.Date.format(coldate,{format: dateFormat}, this.get("diary").get("locale"));
           backgroundEl.appendChild(baseEl);
        
        } else if (this.get("diary").get("display").format == "year") {
           baseEl.innerHTML = YAHOO.util.Date.format(coldate,{format: dateFormat}, this.get("diary").get("locale"));
           backgroundEl.appendChild(baseEl);
           Dom.setStyle(containerEl, "line-height", "20px"); 
        } else {
       
          Dom.addClass( baseEl , CLASS_DIARY_HOURBLOCK);
          Dom.setStyle( baseEl, "height" , (this.get("diary").get("pxPerHour") - 1) + "px");
          
          
          // add times
          for( h = 0; h < 24; h++ ){
            
            newEl = baseEl.cloneNode( false );
            newEl.innerHTML =( h <= 12 ? h + "am" : (h-12) + "pm" );
            Dom.addClass( newEl, "h" + h );
            backgroundEl.appendChild( newEl );
            
          }
        }          
          containerEl.appendChild(backgroundEl);
          containerEl.appendChild(this._dataEl.parentNode.removeChild(this._dataEl));
          parent.appendChild(containerEl);
        


     },



     /**
      * @method _renderBlocks
      * @description Loops through the items in the block and renders them
      * @protected
      */
     _renderBlocks: function(){
       for( var i = 0; i < this._blocks.length; i++ ) {
         this._blocks[i].render( { width: this.get("width") });
       }
     
     },
     
     
     
     
     /**
      * Navigate among columns
      * 
      */
      
     /**
      * @method next
      * @description Get the next column, or null if it's the last.
      * @return DiaryDay || null
      */
     next: function(){
       return this.get("diary").getDiaryDay( this.get("coldate").setHours(0,0,0,0) + 86400000 );
     },
     

     /**
      * @method previous
      * @description  Gets the previous column, or null if it's the first
      * @return DiaryDay || null
      */
     previous: function(){
       return this.get("diary").getDiaryDay( this.get("coldate").setHours(0,0,0,0) - 86400000 );
     },
     
     
     /**
      * @method destroy
      * @description Destructor
      */
     destroy: function(){
       
       var i = 0, j = 0, blocks = this._blocks;
       
       for( i = 0; i < blocks.length; i++ ){
         
         for( j = 0; j < blocks[i]._items.length; j++ ){
           blocks[i]._items[j].destroy();
         }
         blocks[i].destroy();
       }
       
       this.ddt.unreg();
       delete this.ddt;
       this.ddt = {};
     }
  
  });
  
  
  
  
  
  
  
  /**
   *
   * The main diary; 
   *
   * <p>This is the main object.  It:
   *  <ol style="margin-left:30px;">
   *   <li>gets the data</li>
   *   <li>does the main background display</li>
   *   <li>sets up the DiaryDay objects and calls their render methods</li>
   *   <li>holds delegated event listeners for the DiaryItems</li>
   * </ol>
   *
   * @namespace YAHOO.widget
   * @class Diary
   * @extends YAHOO.util.Element
   * @constructor
   * @param el {HTMLElement} Container element for the Diary
   * @param oDS {YAHOO.util.DataSource} DataSource instance.  Each 'row' in the
   *  data will need a start date/time and end date/time, both as js Date objects.
   *  Use the fieldMap config attribute to map data fields to those expected
   *  by Diary - DTSTART and DTEND.
   * @param oCfg {Object} Object literal of config values.
   *
   */
  var Diary = function( el, oDS, oCfg ){

    Diary.superclass.constructor.call( this, el, oCfg);

    this.setupDays();
    this._renderCoreDiary();
    this.initListeners();
    
    this.initData(el, oCfg, oDS );

  };
  
  
  Lang.extend( Diary, YAHOO.util.Element, {
  
     /**
      * @property _colToDayMap
      * @type Object
      * @description provieds a map from columns id's to dates (in seconds)
      * @protected 
      */
     _colToDayMap:{},
     
     /**
      * @property _selector
      * @type Object
      * @description Holds details of a click-and-drag to add new Items
      * @protected
      */
     _selector:{},
     
     /**
      * @property _colWidth
      * @type Int
      * @description Column widths
      * @protected
      */
     _colWidth: 200,
     
     /**
      * @property _ds
      * @type YAHOO.util.DataSource
      * @description Reference to the datasource passed in
      * @protected
      */
     _ds: null,
     

     /**
      * @property _navCalendar
      * @type YAHOO.widget.Calendar
      * @description Navigation calendar
      * @protected
      */
     _navCalendar: null,

     /**
      * @property _tooltip
      * @type YAHOO.widget.Tooltip
      * @description Re-usable tooltip, if included on page
      * @protected
      */
     _tooltip: false,


     /**
      * @property _diaryData
      * @type Array
      * @description Array holding currently displayed data
      * @protected
      */
      _diaryData: [],


     /**
      * @property _lastData
      * @type Object
      * @description Object with cache of last data, pre-parsed, from datasource
      * @protected
      */
      _lastData: {},

     /**
      * @property _itemHash
      * @type Array
      * @description Array holding DiaryItem element ids and DiaryItem refs
      * @protected
      */
      _itemHash: [],
      

     /**
      * @property _lockResize
      * @type Boolean
      * @description Whether resizing of DiaryItems is allowed
      * @protected
      */       
      _lockResize: false,

     /**
      * @property _lockDragDrop
      * @type Boolean
      * @description  Whether drag-dropping of DiaryItems is allowed
      * @protected
      */
      _lockDragDrop: false,
     
      

     /**
      * @property _filters
      * @type Object
      * @description Object of filters currently applied
      * @protected
      */
      _filters: {},
      
      
      /**
       * @property _loadingElId
       * @type String
       * @description Id of 'loading' element
       * @protected
       * @default ''
       */ 
      _loadingElId: '',

      
      
      /**
       * @property _footerEl
       * @type HTMLElement
       * @description Footer element
       * @protected
       * @default undefined
       */ 
      _footerEl: '',


      /**
       * @property _cacheStartEndTimes
       * @type Object
       * @description Caches start/end times for view changes
       * @protected
       * @default {startTime: 8; endTime: 20}
       */      
      _cacheStartEndTimes: {startTime: 8, endTime: 20},


     /**
      * @method initAttributes
      * @param Object
      * @description Object of filters currently applied
      * @private
      */
     initAttributes: function( oCfg ){
 
        Diary.superclass.initAttributes.call( this, oCfg );

           
           /**
            * @attribute keepFirstDay
            * @description Whether the first column should be restricted to 
            * a particular day of the week.  If so, pass the day of the week
            * (with 0 = Sunday).
            * @default false
            * @type {Boolean | Int}
            */
           this.setAttributeConfig('keepFirstDay', {
             value: false,
             validator: function (v) {
               return (Lang.isBoolean(v) || (Lang.isNumber(v) && v >= 0 && v <= 6));
             }
           });
          
          
          /**
           * @attribute locale
           * @description Which locale to use when parsing dates.  See
           * <a href="http://developer.yahoo.com/yui/docs/YAHOO.util.Date.html">
           * YAHOO.util.Date</a> and YAHOO.util.DateLocale. For more info.
           * @type {String}
           * @default "en-GB"
           */
          this.setAttributeConfig('locale', {
            value: "en-GB"
          });
           
           /**
            * @attribute endDate
            * @description Final date currently displayed on Diary
            * @type {Date} (Optional)
            * @default 7 days on from startDate
            */
           this.setAttributeConfig('endDate', {
             method: function(v){
               if (v) {
                  v.setHours(0,0,0,0);
               }
             }
           });
           

           /**
            * @attribute startDate
            * @description When to start the diary display from
            * @type {Date}
            */
           this.setAttributeConfig('startDate', {
             setter: function(v){

               if (this.get("keepFirstDay") !== false && 
                   this.get("display") !== undefined &&
                   this.get("display").format !== "day") {

                 v = DM.getFirstDayOfWeek(v, this.get("keepFirstDay"));

               }
             
               v.setHours(0,0,0,0);
             
               if (!this.get("endDate")) {
                  this.set("endDate", DM.add(v, DM.DAY, 7));
               }
               
               return v;
             }
           });


           
   
          /**
           * @attribute pxPerHour
           * @description  Number of pixels per hour.   Write once.
           * @default: 20
           * @type Number
           */ 
           this.setAttributeConfig( "pxPerHour", {
             validator: Lang.isNumber,
             value: 20,
             writeOnce: true
           });
           
           
                      
           /**
            * @attribute display
            * @description Display formats: object literal with format 
            * and start and end times (in 24-hour clock hours) displayed
            * in the main window (the rest are above and below the scroll.
            * <pre>{ format: "week", startTime: 8, endTime: 20 }</pre>.
            * The only format available currently is "week".  Write once.
            * @type Object
            * @default <pre>{ format: "week", startTime: 8, endTime: 20 }</pre>
            */  
           this.setAttributeConfig( 'display' , {
             value:  { format: "week" , startTime: 8, endTime: 20 },
             method: function( v ) {
             
               var pxPerHour = this.get("pxPerHour");
              

              
               if (v.startTime >= 0) {
                 this._cacheStartEndTimes.startTime = v.startTime;
               } else {
                 v.startTime = this._cacheStartEndTimes.startTime;
               }
               if (v.endTime >= 0) {
                 this._cacheStartEndTimes.endTime = v.endTime;
               } else {
                 v.endTime = this._cacheStartEndTimes.endTime;
               }
            
               // add some methods to the object:
               switch (v.format) {

                 case "month":
                   v.getSeconds = 3024000000;
                   v.getDaysAcross = 7;
                   v.getDaysInView = 35;
                   v.getOnClickFormat = false;
                   v.getDiaryHeight = 100;
                   v.getDiaryScrollTop = 0;
                   v.renderDateLabel = function (oDate) {return oDate.toString().substring(0, 3);};
                   v.getNextFormat = "week";
                   break;
                   
                 case "day":
                   v.getSeconds = 86400000;
                   v.getDaysAcross = 1;
                   v.getDaysInView = 1;
                   v.getOnClickFormat = {format: "week", startTime: v.startTime, endTime: v.endTime};
                   v.getDiaryHeight = parseInt((v.endTime - v.startTime ) * pxPerHour, 10);
                   v.getDiaryScrollTop = parseInt(v.startTime * pxPerHour, 10);
                   v.getNextFormat = "week";
                   break;
                 
                 case "week":
                   v.getSeconds = 604800000;
                   v.getDaysAcross = 7;
                   v.getDaysInView = 7;
                   v.getOnClickFormat = {format:"day", startTime: v.startTime, endTime: v.endTime};
                   v.getDiaryHeight =  parseInt((v.endTime - v.startTime ) * pxPerHour, 10);
                   v.getDiaryScrollTop = parseInt(v.startTime * pxPerHour, 10);
                   v.getNextFormat = "month";
                   break;
                   
                 case "year":
                   v.getSeconds = 31536000000;
                   v.getDaysAcross =35;
                   v.getDaysInView = 460;
                   v.getOnClickFormat = false;
                   v.getDiaryHeight = 20;
                   v.getDiaryScrollTop = 0;
                   v.renderDateLabel = function (oDate) {return oDate.toString().substring(0, 1);};
                   v.getNextFormat = "month";
                   // move to start of current month
                   this.get("startDate").setDate(1);
                   this.set("startDate", this.get("startDate"));
                   break;                 
               }
               

               // add a class
               this.addClass(CLASS_DIARY_DISPLAY[ v.format.toUpperCase() ]);
              
             }
            
            }
           );
           
           
           
           /**
            * @attribute width
            * @description Overall width of Diary (in pixels)
            * @type Number (Optional) Will use element styled width if no value provided and it has one
            */
           this.setAttributeConfig( "width" , {
             method: function( v ){
               if( !( Lang.isNumber( v ) ) ){
                 v = parseInt( Dom.getStyle( this.get("element"), "width" ) , 10 ); 
               }
               if( v > 0 ){
                  Dom.setStyle( this.get("element"), "width" , v + "px" );
               }
             }
            }
          );
    
    
           /**
            * @attribute scaleColumns
            * @description Whether to scale columns to width.  writeOnce
            * @type Boolean
            * @default true
            */       
          this.setAttributeConfig( 'scaleColumns' , {
            
            validator: Lang.isBoolean,
            value: true,
            method: function(v){
              if( v && this.get( "width" ) ){
                // 7 days / week . 7 pixels to allow for scrollbars etc.
                this._colWidth = parseInt(this.get( "width" ) / this.get("display").getDaysAcross, 10) - 4;
                if (this.get("display").format == "month") {
                  this._colWidth -= 2;
                }
              } else {
                this._colWidth = 200;
              }
            },
            writeOnce: false
             
            } 
           );
           


                  
    
    
           
           /**
            * @attribute calenderNav
            * @description Whether to use a YAHOO.widget.Calendar in the navigation.
            *   Write once.
            * @type Boolean
            * @default true
            */       
           this.setAttributeConfig( 'calenderNav', {
             validator: Lang.isBoolean,
             value: true,
             writeOnce: true
           });
           
           

           /**
            * @attribute fieldMap
            * @description  
            * <p>Field map, mapping keys of DataSource to expected 
            * keys of data for DiaryItems.  DiaryItem keys are the keys in the 
            * object passed; values are the names of the fields in the DataSource.
            * backClass is the css class string applied to the background container of the
            * DiaryItem; detailClass is the css class string applied to the element
            * holding the text of the item.  These can be used by addItemFilter
            * to show or hide items by category.</p>
            * <p>DTSTART and DTEND need to be strings; but other values may be
            * functions.  These functions are called on the Diary instance (i.e.
            * this in your function is the Diary, and receive the raw data literal
            * as their only argument.</p>
            *
            * Write once
            *
            * @type {Object}
            * @default <pre> 
             &nbsp;        { UID: "UID",
             &nbsp;          DTSTART: "DTSTART",
             &nbsp;          DTEND:   "DTEND",
             &nbsp;          SUMMARY: "SUMMARY",
             &nbsp;          DESCRIPTION: "DESCRIPTION",
             &nbsp;          CATEGORIES: "CATEGORIES",
             &nbsp;          LOCATION: "LOCATION",
             &nbsp;          URL: "URL",
             &nbsp;          backClass: "backClass",
             &nbsp;          detailClass: "detailClass" }</pre>
            */  
            this.setAttributeConfig( 'fieldMap' , {
            
              value: { UID: "UID",
                       DTSTART: "DTSTART",
                       DTEND:   "DTEND",
                       SUMMARY: "SUMMARY",
                       DESCRIPTION: "DESCRIPTION",
                       URL: "URL",
                       CATEGORIES: "CATEGORIES",
                       LOCATION: "LOCATION",
                       backClass: "backClass",
                       detailClass: "detailClass" },
              setter: function( oMap ){
              
                return Lang.merge( { 
                       UID: "UID",
                       DTSTART: "DTSTART",
                       DTEND:   "DTEND",
                       SUMMARY: "SUMMARY",
                       DESCRIPTION: "DESCRIPTION",
                       URL: "URL",
                       CATEGORIES: "CATEGORIES",
                       LOCATION: "LOCATION",
                       backClass: "backClass",
                       detailClass: "detailClass"
                    }, oMap
                );
              
              },
              writeOnce: true
            
          
          } );
         

           /**
            * @attribute titleString
            * @description String to use as template for title.  You can use 
            * strftime type identifiers.  Write once.
            * @type String
            * @default "Diary w/c %A, %e %B %Y"
            */  
           this.setAttributeConfig( "titleString" , {
             validator: Lang.isString,
             value: "Diary w/c %A, %e %B %Y",
             writeOnce: true
           });
           

           /**
            * @attribute itemClickCreateNew
            * @description Whether you can click and drag on an existing item 
            * to start creating a new one.
            * @type Boolean
            * @default false
            */
           this.setAttributeConfig( "itemClickCreateNew", {
             validator: Lang.isBoolean,
             value: false
           });

           /**
            * @attribute titleString
            * @description String to put in footer element
            * @type Object     Keys: text, hideDelay (optional)
            * @default {text: "", hideDelay: 5000}
            */             
           this.setAttributeConfig( "footerString");
           
           
   
          /**
           * @attribute allowCreateMultiDayItems
           * @description  Whether, when creating new items, they're allowed to span multi days
           * @default: false
           * @type Boolean
           */ 
           this.setAttributeConfig( "allowCreateMultiDayItems", {
             validator: Lang.isBoolean,
             value: false
           });        
          
          
   
          /**
           * @attribute tooltip
           * @description  Whether to use tooltip for mouseover events to show details.
           *   Write once.
           * @default: false
           * @type Boolean
           */ 
           this.setAttributeConfig( "tooltip", {
             validator: Lang.isBoolean,
             value: false,
             writeOnce: true
           });        
                  
          
   
          /**
           * @attribute animate
           * @description  Whether to use animation when moving items around.
           *    Write once.
           * @default: false
           * @type Boolean
           */ 
           this.setAttributeConfig( "useAnimation", {
             validator: Lang.isBoolean,
             value: false,
             writeOnce: true
           }); 




         
           /**
            * @attribute useCssCategories
            * @description If true, any CATEGORIES will be added as css classes
            * to the container element for the DiaryItem, allowing styling and filtering.
            * Anything passed to backClass will also be added.  Spaces in categories
            * will be changed to hyphens.
            * @type Boolean
            * @default false
            */
           this.setAttributeConfig('useCssCategories', {
             validator: Lang.isBoolean,
             value: false
           });

                        
                
      },







       /**
        * @method initListeners
        * @description Set up delegated event listeners for rendering and mouse events
        * @protected
        */
       initListeners: function(){
       
          this.on( "parseData" , this.renderItems, this );

          // clicks just on days
          Ev.delegate(this.get("element"), "mousedown", this.handleDayClick, "div." + CLASS_DIARY_DAY, this, true);
          
          // click and drag new items
          Ev.delegate(this.get("element"), "mousedown", this._startNewItem, "div." + CLASS_DIARY, this, true);
          this.on("mouseup", this._endSelector, this, true);
          
          // click on existing diary items
          Ev.delegate(this.get("element"), "click", this.handleItemClick, "div." + CLASS_DIARY_ITEM, this, true);
          

          
          // mouseover
          Ev.delegate(this.get("element"), "mouseenter", this.handleItemMouseEnter, "div." + CLASS_DIARY_ITEM, this, true);

          // listener for header clicks
          Ev.delegate(this.get("element"), "click", this._handleColumnHeaderClick, "span." + CLASS_DIARY_COLLABEL, this, true);
          
          // listend for month -> week view change clicks:
          Ev.delegate(this.get("element"), "click", this._handleMonthToWeekClick, "div." + CLASS_DIARY_GOTO_WEEK, this, true);
          
          // change display date
          this.on("startDateChange", this._reDo, true, this);
          
          // change display format
          this.on("displayChange", this._reFormat, this);
          
          // Change footer text
          this.on("footerStringChange", this._setFooter, this);
       
       },



       /**
        * @method setupDays
        * @description Display days of the week holders
        * @protected
        */
       setupDays: function() {
      
         YAHOO.log("Diary.setupDays" ,"info" );
      
         var calHolder = document.createElement( "div" ),
              i, j = 0, 
              parent = calHolder,
              dayEl = document.createElement( "div" ),
              monthLabelEl = document.createElement("div"),
              newDayEl , 
              zeroTime = parseInt( this.get("startDate").getTime(), 10 ),
              day,
              displayFormat = this.get("display"),
              // default = week (604800000)
              limitTime = zeroTime + displayFormat.getSeconds,
              that = this,
              dayCount = 0,
              jumpToWeekEl;


        
         Dom.addClass( calHolder, CLASS_DIARY );
         Dom.addClass( monthLabelEl, CLASS_DIARY_MONTHLABEL);
         this._calHolder = calHolder;

         if (this._footerEl) {
           this.get("element").insertBefore(calHolder, this._footerEl);
         } else {
           this.get("element").appendChild(calHolder);
         }

          
          dayEl.className = CLASS_DIARY_DAY;
          
          if (displayFormat.format == "month") {
            jumpToWeekEl = document.createElement("div");
            Dom.addClass(jumpToWeekEl, CLASS_DIARY_GOTO_WEEK);
            jumpToWeekEl.innerHTML = "&gt;<br/>&gt;";
            jumpToWeekEl.title = "View this week in week view";
          }
          
          day = new Date(zeroTime); 
          i = zeroTime ;
          // loop through from start to end adding a new DiaryDay for each
          while(i < limitTime) {
        
            newDayEl = dayEl.cloneNode(true);
            j = Dom.generateId( newDayEl , 'day-' );
            

            
            this._diaryData[ i ] = new DiaryDay( newDayEl, { coldate: day , diary: this , width: this._colWidth }  );
        
            parent.appendChild( newDayEl );
            this._colToDayMap[j] = i;
        
            dayCount++;
            if (dayCount%7 == 0 && displayFormat.format == "month") {
              parent.appendChild(jumpToWeekEl.cloneNode(true));
            }
            
            day = DM.add(day, DM.DAY, 1);
            i = day.getTime();
          }
          
          this._renderCoreDiary();       
          // set the scrollTop and position of the visible pane:
          this._setDiaryPosition();
          
          // set a timer to move the 'today' class to the next column at midnight.
          (function(){
             
             var now = new Date(),
                 timeToMidnight = that._getEndOfDay(now).getTime() - now.getTime() + 1000,

                 todayClassMover = function(){


                      var currentColEl = Dom.getElementsByClassName(CLASS_DIARY_TODAY, "div", that.get("element")),
                          i,
                          colmap = this._colToDayMap,
                          currentCol,
                          now = new Date().setHours(0,0,0,0);

                          
                      // if the current col's in view, remove the today class,
                      // and add it to the next col if poss
                      if (currentColEl && currentColEl[0]) {
                        currentColEl = currentColEl[0];
                        currentCol = this._diaryData[colmap[currentColEl.id]];
                        Dom.removeClass(currentColEl, CLASS_DIARY_TODAY);
                        if (currentCol.next()) {
                          Dom.addClass(currentCol.next(), CLASS_DIARY_TODAY);
                        }
                      } else {
                        // see if today is now in view:
                        for (i in colmap) {
                          if (colmap[i] === now) {
                            Dom.addClass(i, CLASS_DIARY_TODAY);
                            break;
                          }
                        }
                      }
                      

                      
                      // and now add another timer for 24hours time:
                      Lang.later(86400000, this, todayClassMover, null, false);
                 };
             
             // at midnight set the next class
             Lang.later(timeToMidnight, that, todayClassMover, null, false);
             
          })();
          
       },
       
       
       /**
        * @method getDiaryDay
        * @description Get the DiaryDay object based on date (in seconds)
        * @param secsDate {Int}  start time in seconds.
        * @return {Object} DiaryDay 
        */
       getDiaryDay: function( secsDate ) {
         YAHOO.log( "Diary.getDiaryDay " , "info");
         return this._diaryData[ secsDate ];
       },



       /**
        * @description Click and drag to add new DiaryItem
        * @method _startNewItem
        * @protected
        * @param ev {Event}
        */
       _startNewItem: function( ev ){
          
          YAHOO.log( "Diary._startNewItem", "info");

          var el, sel, dayEl, target = Ev.getTarget(ev) , x, y, div;



           /**
            * @event itemBeforeStartCreate
            * @description Before starting to create a new item by click and dragging
            * If subscribers return false the start is cancelled.
            * @param oArgs.originEvent  Event passed through
            */
           if( false === this.fireEvent( "itemBeforeStartCreate", {originEvent: ev } ) ){

             return;
           }
           
           if( ( Dom.hasClass( target, CLASS_DIARY_ITEM) || 
                 Dom.getAncestorByClassName(target,  CLASS_DIARY_ITEM ) ) && 
                 !this.get( "itemClickCreateNew" ) ){ 
            return;
           }
  
           // only start a new one if previous ones have finished:
           if( this._selector.selectorDiv === undefined || this._selector.selectorDiv === null ){ 
  
            el = this._calHolder;
            sel = this._selector;
  
           // column we're over:
            dayEl = Dom.getAncestorByClassName( Ev.getTarget(ev), CLASS_DIARY_DAY);
            if( dayEl === null || dayEl === undefined ){
              return;
            }
            sel.dayNumber = dayEl.id;
  
     
             Ev.addListener( el , 'mousemove', this._resizeSelectorDiv , this, true );
          //   Ev.addListener( el , 'mouseup' , this._endSelector , this, true );
             
             x = Ev.getPageX( ev );// ev.clientX;
             y = Ev.getPageY( ev ) - Dom.getDocumentScrollTop(); //ev.clientY;
             
             sel.startX = x;
             sel.startY = y;
             
             div = document.createElement( 'div' );
             Dom.addClass( div, CLASS_DIARY_SELECTOR);
             Dom.setStyle( div, 'left', x + 'px' );
             Dom.setStyle( div, 'top', y + 'px' );
             Dom.setStyle( div, 'width', '0px' );
             Dom.setStyle( div , 'height', '0px' );

    
            
             sel.selectorDiv = div;
             // append to the data el
             Dom.getElementsByClassName( CLASS_DIARY_DATACONTAINER,
                                        "div", dayEl, 
                                        function(n) {n.appendChild(div);} );

             Ev.stopEvent(ev);
          }
           
       },
       
 
     
     /**
      * @description Resizes the selector when creating a new item
      * @method _resizeSelectorDiv
      * @protected
      * @param ev {Event}
      */    
     _resizeSelectorDiv: function( ev ){
     
        var x = Ev.getPageX( ev );// ev.clientX;
        var y = Ev.getPageY( ev ) - Dom.getDocumentScrollTop();//ev.clientY;
        var startX = this._selector.startX;
        var startY = this._selector.startY;
        
        var top, left, width, height;
        
        // work out co-ords
        if( x < startX ){
           width = startX - x;
           left  = x;
        }
        else{
           width = x - startX;
           left  = startX;
        }
        
        if( y < startY ){
           top   = y;
           height = startY - y;
        }
        else{
           top    = startY;
           height = y - startY;
        }
        
        //height -= Dom.getDocumentScrollTop();
        
        
        var div = this._selector.selectorDiv;
      
        Dom.setStyle( div, 'width' , width + "px" );
        Dom.setStyle( div, 'height' , height + "px" );
        Dom.setStyle( div, 'left' , left + "px" );
        Dom.setStyle( div, 'top' , top + "px" );
        
        Ev.stopEvent(ev);
     },
     
     
     /**
      * @description Called at the end of selector - creating a new item by drag-drop
      * @method _endSelector
      * @protected
      * @param ev {Event}
      */
     _endSelector: function(ev){

   
        YAHOO.log( "Diary._endSelector " , "info");
        
            // start day of new item
        var itemDay = this._colToDayMap[ this._selector.dayNumber ], 
            // date object of new item
            itemStartDate = new Date( itemDay ), 
            // final day of new item
            finalDayEl = Dom.getAncestorByClassName( Ev.getTarget(ev), CLASS_DIARY_DAY),
            // final day id and date
            finalDayNumber = ( finalDayEl ) ? finalDayEl.id : 0,
            finalItemDay = this._colToDayMap[ finalDayNumber ],
            // end date is either same day or where the mouse-upped
            itemEndDate = new Date( ( this.get("allowCreateMultiDayItems" ) ? finalItemDay : itemDay ) ),
            // work out times from mouse positions
            regionT = parseInt( Dom.getRegion( this._diaryData[ itemDay ]._backgroundEl ).top , 10 ),
            t = Math.abs( parseInt( Dom.getStyle( this._selector.selectorDiv, "top" ) , 10 ) - 
                          regionT + Dom.getDocumentScrollTop()),
            h = parseInt( Dom.getStyle( this._selector.selectorDiv, "height" ), 10 ),
            // the new DiaryItem
            newItem,
            // tidies up after the item's been created
            cleanUp = function( ob ){
                Ev.purgeElement( ob._calHolder, false, 'mousemove' );
                //Ev.purgeElement( ob._calHolder, false, 'mouseup' );
                var div = ob._selector.selectorDiv;
                div.parentNode.removeChild( div );
                ob._selector.selectorDiv = null;
                ob._selector.startX = null;
                ob._selector.startY = null;            
            };


         /**
          * @event itemBeforeEndCreate
          * @description Fired on the mouseup after drag-selecting to create a new Item.
          * This is fired before the actual item is created and rendered.
          * If subscribers return false the start is cancelled.
          */
         if( false === this.fireEvent( "itemBeforeEndCreate", {
             DTSTART: itemStartDate,
             DTEND: itemEndDate,
             originEvent: ev } ) ){
           
           cleanUp( this );
           return;
         }

            
        if( h > 0 ){
            
            
            var itemCfg = { DTSTART: 0 , DTEND: 0 , SUMMARY: '' },
                now,
                startHours,
                startMins,
                endHours,
                endMins,
                tSecs,
                hSecs;
            
            // month view: set times to now and +1 hour
            if (this.get("display").format == "month" || this.get("display").format == "year") {
              
              now = new Date();
              startHours = now.getHours();
              startMins = now.getMinutes();
              endHours = Math.min(startHours + 1, 23);
              endMins = startMins;

            } else {
            
              // work out times from drag-drop
              tSecs = DiaryItem.prototype.calcStartFromPosition( t ,this.get("pxPerHour"));
              hSecs = DiaryItem.prototype.calcEndFromPosition(h, t, this.get("pxPerHour"));
              
              startHours = Math.floor( tSecs / 3600 );
              startMins = Math.floor( (tSecs - ( startHours * 3600 ) ) / 60 );
              endHours = Math.floor(  hSecs / 3600 );
              endMins = Math.floor( ( (  hSecs ) - ( endHours * 3600 ) ) / 60 );
            
            }

            // to nearest 15 minutes
            startMins = startMins - ( startMins % 15 );
            endMins = endMins - ( endMins % 15 );
            
            // set the times
            itemStartDate.setHours( startHours , startMins );
            itemEndDate.setHours( endHours , endMins );

            
            
            itemCfg.DTSTART = itemStartDate;
            itemCfg.DTEND = itemEndDate;
  
            // the new DiaryItem
            newItem = this.addItem( itemCfg, true );
        
            cleanUp( this );

         /**
          * @event itemEndCreate
          * @description Fired at the end of thee mouseup after drag-selecting to create a new Item.
          * This is fired after the actual item is created and rendered.
          */        
        this.fireEvent( "itemEndCreate" , { item: newItem } );
        
        } else {
           cleanUp( this );
        }
        


        
     },
     
     
     
     /**
      * @description Add an item to the Diary
      * @method addItem
      * @param oCfg   {Object}      Data for the new item, minimally- DTSTART: oDate, DTEND: oDate 
      * @param redraw {Boolean}     Whether to redraw once it's added
      * @return {DiaryItem}  The new item created
      */
     addItem: function( oCfg , render ){
   
        var itemDay, 
            newItem, 
            firstItem, 
            itemDayDate, 
            nextColumn, 
            newConfig,
            that = this,
            saveAndRender;
     
        if( render === undefined || render === null ){
          render = false;
        }
        
        /**
         * @event beforeAddItem
         * @description Before an item is added to the Diary
         * @param Object  Object literal containing data
         */
         
        this.fireEvent("beforeAddItem", {data: oCfg});


        
        // which column are we adding this to?
        itemDay = this._findFirstItemDay(oCfg.DTSTART, oCfg.DTEND);

        
        if (itemDay === false) {
          return false;
        }
        
 
         // useful internal function to save and render a newly added item
         saveAndRender = function (item) {

            that._itemHash[item.get("element").id] = item;
      
            if (render) {
               that._diaryData[item.get("column").get("coldate").getTime()]._rebuildBlocks();
               that._diaryData[item.get("column").get("coldate").getTime()]._renderBlocks();
            }
            
            that._applyFiltersToElement( item.get("element") );
            
            // lock if necessary:
            if (that._lockResize) {
              item.lock();
            }
            if (that._lockDragDrop) {
              item.dragdrop.lock();
            }
            
         };
 
 
        
        // Create a date object for the column date
        itemDayDate = new Date(itemDay);
        
        
        // Alter the config passed to DiaryItem:
        newConfig = Lang.merge(oCfg, { 
                resizeTop: true, 
                resizeBottom: true ,
                enableDragDrop: true,
                useAnimation: this.get("useAnimation"),
                pxPerHour: this.get("pxPerHour"),
                useCssCategories: this.get("useCssCategories")
        });
        
        
        
        // if it's a one-day item, just add it:
        
        if (this._sameDay(oCfg.DTSTART, oCfg.DTEND)) {
        
           firstItem = this._diaryData[itemDay].addItem(newConfig);
           saveAndRender(firstItem);
          
        }
        
        
        // otherwise it extends over several days:
        
        else {
        

              nextColumn = this._diaryData[itemDay];

              // loop through until we reach the end of the Diary view, or the end of the event
              while (nextColumn !== undefined && !DM.after( nextColumn.get("coldate") , oCfg.DTEND)) {


                  // Alter the config passed to DiaryItem:                                                            
                  newConfig = Lang.merge(oCfg, {
                      resizeTop: true,
                      resizeBottom: true, 
                      enableDragDrop: true,
                      useAnimation: this.get("useAnimation"),
                      pxPerHour: this.get("pxPerHour"),
                      useCssCategories: this.get("useCssCategories")
                  });                  
                  
                                 
                 // Is the real start date of the item the same as the column
                 // we're adding it to?
                 
                 if (this._sameDay(oCfg.DTSTART, nextColumn.get("coldate"))) {
                 
                   // this is the first of a multi-day event: 
                   //   displayed start time == DTSTART
                   //   top handle for resize
                   //   no drag-drop
                   //   no bottom handle for resize
                   newConfig = Lang.merge(newConfig, { 
                           resizeBottom: false ,
                           enableDragDrop: false ,
                           _displayDTSTART: oCfg.DTSTART,
                           _displayDTEND: this._getEndOfDay(nextColumn.get("coldate")),
                           multiDayPosition: "first"
                   });

            
                 } else {
                 
                   // is this the last day of the item?
                   if (this._sameDay(oCfg.DTEND, nextColumn.get("coldate"))) {
                   
                       //   displayed end time == DTEND
                       //   display start tiem = midnight
                       //   no top handle for resize
                       //   no drag-drop
                       //   bottom handle for resize
                       newConfig = Lang.merge(newConfig, { 
                               resizeTop: false,
                               enableDragDrop: false,
                               _displayDTSTART: nextColumn.get("coldate"),
                               _displayDTEND: oCfg.DTEND,
                               multiDayPosition: "last"
                       });

                       
                   } else {
                   
                     // this is an intermediate item 
                     // no dragdrop
                     // no resize
                     // runs from midnight to midnight
                     newConfig = Lang.merge(newConfig, { 
                           resizeBottom: false ,
                           resizeTop: false,
                           enableDragDrop: false ,
                           _displayDTSTART:  nextColumn.get("coldate"),
                           _displayDTEND: this._getEndOfDay(nextColumn.get("coldate")),
                           multiDayPosition: "mid"
                     });

                   }
                   
                 
                 } // end of setting up the config objects


                 // create and add the new Item:
                 newItem = nextColumn.addItem(newConfig);
           
                 if (firstItem === undefined || firstItem === null) {
                 
                   firstItem = newItem;
                 
                 } else {
                 
                   // add parent/child references:
                   firstItem.addMultiDayChild(newItem);
                   newItem.set("multiDayParent", firstItem);
                   
                 }
                 
                 saveAndRender(newItem);
              
                 // go on to the next column:
                 nextColumn = nextColumn.next();
           
              
              }// end of while loop
           

        
        
        } // end of adding multi-day events
               
        


        
        return firstItem;
     },





 
 
 
     
     /**
      * @method getItem
      * @description Returns the DiaryItem with id elId
      * @param elId {String}
      * @return {DiaryItem}
      *
      */
     getItem: function (elId) {
       var el = this._itemHash[ elId ];
       if (el) {
         return el;
       }
       return false;
     },     
     
     
     /**
      * @method removeItem
      * @description Removes an item from the diary and destroys the element
      * @param item {Object}  DiaryItem to remove
      */
     removeItem : function (item) {
       
       if (item === undefined) {
         return false;
       }
              
       
       var elId = item.get("element").id,
           col = item.get("column");


       col.removeItemFromBlock(item);

       item.destroy();
       item = null;

       delete this._itemHash[elId] ;
       
       col._rebuildBlocks();
       col._renderBlocks(); 

       
     },
     
     
     
     /**
      *
      * Event handlers
      *
      *
      */
      
      /**
       * @description When a DiaryItem is clicked
       * @method handleItemClick
       * @param ev {Event}
       * @param el {HTMLElement}
       * @param el {HTMLElement}
       * @protected
       */
     handleItemClick: function (ev, el, container) {
         YAHOO.log( 'Diary.handleItemClick', "info");
         
         /**
          * @event itemClick
          * @param oArgs.item  The DiaryItem clicked on
          * @param oArgs.ev    The click event
          * @param oArgs.el    The element clicked on
          * @param oArgs.container  The container element (from delegate)
          */
         this.fireEvent("itemClick", { 
                           item: this.getItem(el.id),
                           ev:   ev,
                           el:   el,
                           container: container 
         });
                     
     },
     
   
     /**
      * @method handleItemMouseEnter
      * @description When a DiaryItem is mouseenter-ed.  Default behaviour
      * is to show a tooltip (if this was enabled in the config).  The
      * itemMouseEnter event is fired first; return false to this to stop 
      * the default behaviour.
      * @param ev {Event}
      * @param el {HTMLElement}
      * @param container {HTMLElement}
      * @protected
      */
     handleItemMouseEnter : function( ev, el, container ){

         /**
          * @event itemMouseEnter
          * @description When a mouse enters a DiaryItem.  Return false
          * to cancel default behaviour (tooltip at the moment).
          * @param oArgs.item  The DiaryItem mouseentered
          * @param oArgs.ev    The mouseenter event
          * @param oArgs.el    The element 
          * @param oArgs.container  The container element (from delegate)
          */
         if( false !== this.fireEvent( "itemMouseEnter" , 
                         { item: this.getItem( el.id ),
                           ev:   ev,
                           el:   el,
                           container: container } ) ){
                           
            // Default behaviour: show tooltip with full details:
            if( this._tooltip ){
             
              this.getItem(el.id)._detailsEl.title = "";
              this._tooltip.setBody( this.getItem(  el.id ).renderFullDetails() );
              this._tooltip.cfg.setProperty( "context" , el );
              this._tooltip.cfg.setProperty( "disabled" , false );
              this._tooltip.show();
            }
                              
         }
     },

     
     /**
      * @method handleDayClick
      * @description Handles clicks on the day container
      * @public
      * @param ev {Event}
      * @param el {HTMLElement}
      * @param container {HTMLElement}
      */
     handleDayClick: function(ev, el, container) {

         /**
          * @event dayClick
          * @description When a day container is clicked. 
          * @param oArgs.el    The element clicked on
          * @param oArgs.day   A date object representing the day clicked
          */
       this.fireEvent("dayClick", {
         el: el,
         day: new Date(this._colToDayMap[el.id])
       });
       //Ev.stopEvent(ev);
     },
     
     
     /**
      * @method _handleColumnHeaderClick
      * @description Handles column header clicks.  Does different things 
      * depending on view: on week view, goes to day-to-view; on day view
      * goes back to week view; on month view does nothing.
      * @protected
      */
     _handleColumnHeaderClick : function (ev, el, container) {

       var i,
           parent = el.parentNode,
           newFormat = this.get("display").getOnClickFormat;

       if (!newFormat) {
         return;
       }
       

       this.set("display", newFormat, true);

       // set the new date
       for (i = 0; parent.childNodes.length; i++) {
         if (el === parent.childNodes[i]) {
           this.set("startDate", DM.add(this.get("startDate"), DM.DAY, i), true);
           break;
         }
       }
       
       // change the new format (hack to trigger change event on second one)
       this.set("display", {format:"a"}, true);
       this.set("display", newFormat, false);

     },
     
     
     /**
      * @method _handleMonthToWeekClick
      * @description Handles clicks on the right-hand 'go to week view' 
      * when in month view.  Works out which week it is and then reformats.
      * @protected
      */     
     _handleMonthToWeekClick: function (ev, el, container) {

       // work out the date of the previous day: this will be the end of the week
       var newEndDate = new Date(this._colToDayMap[ Dom.getPreviousSibling(el).id ]),
           newStartDate = DM.subtract(newEndDate, DM.DAY, 6);

       this.set("startDate", newStartDate, true);
       this._changeView();

       this.set("display", { format: "week" }, false);
     
     },
     
     
     
     
     /**
      *
      *
      *
      * Navigation
      *
      *
      *
      *
      */
     
     /**
      * @method _doPrevious
      * @description Go to the previous day/week
      * @protected
      * 
      */
      _doPrevious : function() {

          var newStartDate = DM.subtract( this.get("startDate"), DM.DAY, this.get("display").getDaysAcross);
          this.set("startDate", newStartDate);

      },

     /**
      * @method _doNext
      * @description Go to the next day/week
      * @protected
      */      
      _doNext : function() {

          var newStartDate = DM.add(this.get("startDate"), DM.DAY, this.get("display").getDaysAcross);
          this.set("startDate", newStartDate);
      },
      
     /**
      * @method _doCalNav
      * @description Go to any start date (set by calendar)
      * @param ev {Event}
      * @param selDate {Array} Selected date, as returned by YAHOO.util.Calendar
      *   (ie array [[[ yyyy, mm, dd]]])
      * @protected
      */      
      _doCalNav : function(ev, selDate) {
         this._navCalendar.hide();
         this.set( "startDate" ,new Date( selDate[0][0][0], selDate[0][0][1] - 1 , selDate[0][0][2] ) );
      },
      
      /**
       * @method _doFirstDayOfTodaysWeek
       * @description Goes to the start of this week
       * @protected
       */
      _doFirstDayOfTodaysWeek: function() {

         YAHOO.log("Diary._doFirstDayOfWeek "  , "info");
         
         var startOfWeek =  DM.getFirstDayOfWeek(new Date(), 1);
         
         // do we need to change?
         if( DM.between(startOfWeek, this.get("startDate"), this.get("endDate"))) {
           return;
         }

         this.set("startDate", startOfWeek);
      },
      
      
      /**
       * @method _changeView
       * @description Changes between views (day/week/month)
       * @protected
       */
      _changeView : function (ev, el, newDisplay) {
      
        YAHOO.log("Diary._changeView", "info");
        
        var display = this.get("display"),
            newDisplay = newDisplay || {
              format: display.getNextFormat,
              startTime : display.startTime,
              endTime : display.endTime
            };  

        this.set("display", newDisplay);
      
      },
      
      /**
       * @method _reDo
       * @description Redraws calendar.  If getData is true, it will delete
       * DiaryItems and data currently held first
       * @param getData {Boolean}
       * @protected
       */
      _reDo: function (getData) {


          this.set("endDate", DM.add(this.get("startDate"), DM.DAY, this.get("display").getDaysInView));

          /**
           * @event beforeReDo
           * @description Fired before the Diary is redrawn, which happens
           *  on navigation (onStartDateChange)
           * 
           */
          
          this.fireEvent( "beforeReDo" );
          
          
          
          this._destroyDays();
          
          this._destroyData();

          
          this.setupDays();
          
          if (getData) {
            this.initData( this.get("element"), {}, this._ds );
          } else {
            this._parseData(this._ds, this._lastData);
          }
          
          this._renderTitle();
          this._renderColumnLabels();
          this._applyFilters();
      },





       /**
        *
        * Data methods
        *
        *
        */
        
        /**
         * @method initData
         * @description Store a reference to the data and get it
         * @param el {HTMLElement}
         * @param oCfg {Object}
         * @param oDS {YAHOO.util.DataSource}
         * @protected
         */
       initData: function( el, oCfg, oDS ){
         
         YAHOO.log( "Diary.initData" ,"info");
         this._ds = oDS;
         this._getData( oDS );
       
       },




  
      /**
       * @method _getData
       * @description Gets data from the data source
       * @param oDS {YAHOO.util.DataSource}
       * @protected
       */
      _getData: function( oDS ){
         /**
          * Fired before data requested
          * @event dataRequest
          * @description Fired before data requested
          * @param oArgs.DataSource    DataSource
          * @param oArgs.target   Diary
          */
         this.fireEvent("dataRequest", {DataSource: oDS, target: this});
         
         this._renderLoading();
         
         oDS.sendRequest( '' , { success: this._parseData,            
                                  failure: this._dataFailed,
                                  scope: this 
         });

      },
      
      
      /**
       * Parses the data when it comes
       * @param req  {Object}    Request object
       * @param data {Object}    Data returned by DataSource
       * @protected
       */
      _parseData: function ( req, data ){

         YAHOO.log( "Diary._parseData starting" , "info" );

         // sort the raw data:
         //data.results.sort( this._rawItemSorter );
         
         var num = data.results.length, 
             itemDate, 
             itemDay, 
             i,
             startDate = this.get("startDate"),
             endDate = this.get("endDate" ),
             tempVal,
             newData = {},
             currentData = {},
             fieldMap = this.get("fieldMap");
      
         this._lastData = data;
    
         for( i = 0; i < num; i++ ){
        
         
           currentData = data.results[i];

           if (currentData[fieldMap.DTSTART] !== undefined) {
              
           // make sure it ends after it starts: swap if not
           if( DM.before( currentData[ fieldMap.DTEND ], currentData[fieldMap.DTSTART] ) ){   
              tempVal = currentData[fieldMap.DTSTART];
              currentData[fieldMap.DTSTART] = currentData[ fieldMap.DTEND ];
              currentData[ fieldMap.DTEND ] = tempVal;
           }


           // Get a 'zero' start date to group by day
           itemDate = currentData[fieldMap.DTSTART];

           // check item is in current date range:
           if( !( DM.after( itemDate, endDate ) || 
                  DM.before( currentData[ fieldMap.DTEND ] , startDate ) ) ){

               itemDay = this._findFirstItemDay( itemDate, currentData[ fieldMap.DTEND ] );
               


               if( itemDay === false ){ 
                  YAHOO.log( "ERROR Data parsed not in range", "warn" );
               } else {
                 // Add the diary item for relevant day

                 newData = this._parseDataUsingFieldmap(currentData);
                 this.addItem(newData, true);

               }
           } else {
              YAHOO.log("data no tin range", "warn");
           }
          
          } else {
              YAHOO.log("data no start date", "warn");
          }
           
         }
      
      
       this._renderLoading();
      
       /**
        * Fired when data parsed and ready
        * @event parseData
        * @description Fired when data's been parsed
        * @param oArgs.data     Parsed data
        * @param oArgs.type     "parseData"
        * @param oArgs.target   Diary
        */
        this.fireEvent( "parseData" , { 
               type: "parseData" , 
               data: this._diaryData, 
               target: this 
        });

        YAHOO.log("end of parse" , "info");    
      },
      
      
      
      /**
       * @method _parseDataUsingFieldMap
       * @description Uses fieldMap given in config to extract from raw data
       * to format expected by DiaryItems.  Values in the fieldMap may be strings
       * or functions, so this applies them as appropriate.
       * @protected
       * @param oData {Object}  Object literal containing raw data to be parsed
       * @return {Object} Object literal containing parsed data.
       */ 
      _parseDataUsingFieldmap : function (oData) {
          var data = {},
              fieldMap = this.get("fieldMap"),
              i = 0,
              field,
              fieldKey,
              that = this;
          
          // Loop through valid fields, and get data from oData as necessary.
          for (i; i < ITEM_FIELDS.length; i++) {
          
            field = ITEM_FIELDS[i];
            fieldKey = fieldMap[field];
            
            if (fieldKey !== undefined) {
          
              if (YAHOO.lang.isString(fieldKey)) {
                data[field] = oData[fieldKey];
              } else if (YAHOO.lang.isFunction(fieldKey)) {
                data[field] = fieldKey.call(that, oData);
              }
              
            }
          
          }
     
          return data;
      },

      
      
      
      /**
       * @description Looks for the first day between startDate and endDate that has a column
       * in the diary; multi-day items may not start in range but may go into it.
       * @param  startDate {Date}
       * @param  endDate {Date}
       * @return {Date|false}  Date or first if it doesn't fall in range.
       * @private
       */
      _findFirstItemDay: function( startDate, endDate ){

        var testDate = startDate,
            testZeroDay = new Date( testDate.getFullYear(), testDate.getMonth(), testDate.getDate() , 0 , 0 , 0 , 0 ).setHours(0,0,0,0);

        while( !DM.after( testDate, endDate ) ){
          
          if( this._diaryData[ testZeroDay ] !== undefined ){
            return testZeroDay;
          }
          testDate = DM.add( testDate, DM.DAY, 1 );
          testZeroDay = testDate.setHours(0,0,0,0);
        }
        return false;
      
      },
      
      
      /**
       * @method _getDay
       * @description Returns a Date object with times set to 0
       * @param  date {Date}
       * @return {Date}
       * @private
       */
      _getDay: function ( date ){
      
        return new Date( date.getFullYear(), date.getMonth(), date.getDate() , 0 ,0,0,0);
      
      },
      
      
      /**
       * @method _getEndOfDay
       * @description Returns a Date object with times set to 23:59:59
       * @param date {Date}
       * @return {Date}
       * @private
       */      
      _getEndOfDay: function ( date ){
        if( Lang.isNumber( date ) ){
          return new Date( date ).setHours( 23,59,59,0 );
        }
        return new Date( date.getFullYear(), date.getMonth(), date.getDate() , 23 ,59,59,0);      
      },
      
      /**
       * @method _sameDay
       * @description Are date1 and date2 the same day?
       * @param date1 {Date}
       * @param date2 {Date}
       * @return {Boolean}
       * @private
       */
      _sameDay: function ( date1, date2 ){
        return ( date1.getFullYear() == date2.getFullYear() && date1.getMonth() == date2.getMonth() && date1.getDate() == date2.getDate() );
      
      },
      
      /**
       * @method _dataFailed
       * @description Called if sendRequest fails on the data
       * @method _dataFailed
       * @param req {object}   Request object that failed
       * @private
       */
      _dataFailed: function( req ){

          this._renderLoading();

          YAHOO.log( "Failed to get data" );
          /**
          * @event dataFailure
          * @description Fired when data has failed
          * @param oArgs.request  Request object from DataSource
          */
          this.fireEvent( "dataFailure" , { request: req } );

      },



      
      /**
       * @method _itemSorter
       * @description Sorting function for arranging items in ascending date/time order
       * @param oItem1 {DiaryItem}
       * @param oItem2 {DiaryItem}
       * @return {Boolean}        True if oItem2 is before oItem1
       * @private
       */
      _itemSorter: function( oItem1 , oItem2 ){ 
        return DM.before( oItem2.get( "DTSTART" ) , oItem1.get( "DTSTART" ) );
      },
      
      /**
       * @method _rawItemSorter
       * @description Sorting function for arranging items in ascending date/time order, using raw data objects
       * @param oItem1 {Date}    Property DTSTART used for sorting
       * @param oItem2 {Date}    Property DTSTART of comparison item for sort
       * @return {Boolean}       True if oItem2 is before oItem1
       * @private
       */      
      _rawItemSorter: function(oItem1, oItem2) { 
        if (oItem1 === undefined || oItem1 === null) {
          return true;
        }
        if (oItem2 === undefined || oItem2 === null) {
          return false;
        }
        var fieldMap = this.get("fieldMap");
        return DM.before( oItem2[fieldMap.DTSTART] , oItem1[fieldMap.DTSTART] );
      },










      /**
       *
       *
       *
       * render methods
       *
       *
       *
       *
       */



      /**
       * @method render
       * @description Renders the Diary.  Called after data is parsed - shouldn't
       * need to be called otherwise.
       * 
       */
      render: function(){


         this._renderCoreDiary();
         
         this.renderItems();
         

         /**
          * @event render
          * @description When the rendering of the Diary is complete
          * @param oArgs.target  Diary
          */ 
         this.fireEvent( "render" , { target: this });

      },
      
      
      /**
       * @method _renderCoreDiary
       * @description Renders the Diary except for the items
       * 
       */
      _renderCoreDiary : function () {
         
         if (this.hasClass(CLASS_DIARY_CONTAINER)) {
           return;
         }
         
         this.addClass(CLASS_DIARY_CONTAINER);
         
         //this._renderDays();
         
         this._renderNav();
         this._renderFooter();
         
           

         this._renderTooltip();
      },
      

      /**
       * @method _renderNav
       * @description Renders the navigation. 
       * Provides left, today, calendar and right buttons, and adds listeners.
       * @protected
       * 
       */      
      _renderNav : function() {
      
        if( this.getNavContainer() !== false ){
          return;
        }
      
        var navContainer = document.createElement("div"),
            titleContainer = document.createElement("div"),
            buttonContainer = document.createElement("div"),
            calContainer, cal, calId, calShowButton,
            left = document.createElement("a"),
            right = document.createElement("a"),
            today = document.createElement("a"),
            view = document.createElement("a"),
            dayLabels = document.createElement("div");
        
        
  
  //      Dom.insertBefore( labelEl, parent.firstChild );
            
        Dom.addClass(navContainer, CLASS_DIARY_NAV );
        Dom.addClass(titleContainer, CLASS_DIARY_TITLE);
        Dom.addClass(buttonContainer, CLASS_DIARY_NAV_BUTTONS);
        Dom.addClass(left, CLASS_DIARY_NAV_LEFT);
        Dom.addClass(right, CLASS_DIARY_NAV_RIGHT);
        Dom.addClass(today, CLASS_DIARY_NAV_TODAY);
        Dom.addClass(view, CLASS_DIARY_NAV_VIEW);
        
        left.innerHTML = "previous";
        left.title = "Go to previous week";
        right.innerHTML = "next";
        right.title = "Go to next week";
        today.innerHTML = "today";
        today.title = "Go to today";
        view.innerHTML = "change view";
        view.title = "Switch between day, week and month view";
        
        
        navContainer.appendChild( titleContainer );
        
        buttonContainer.appendChild( left );
        
        if( YAHOO.widget.Calendar !== undefined && this.get("calenderNav") ){
          calContainer = document.createElement("div");
          calShowButton = document.createElement("div");
          
          calId = Dom.generateId();
          Dom.addClass( calContainer, CLASS_DIARY_NAV_CAL );
          Dom.addClass( calShowButton, CLASS_DIARY_NAV_CALBUTTON);
          calShowButton.appendChild( document.createTextNode( "show calendar" ) );
          calShowButton.title = "Show calendar navigation";
          Ev.on( calShowButton , "click" , this.showNavCalendar, this, true );
          
          calContainer.id = calId;
          buttonContainer.appendChild(calShowButton);
          document.body.appendChild(calContainer);

        }
        
        buttonContainer.appendChild(today);
        buttonContainer.appendChild(view);
        buttonContainer.appendChild(right);
        
        navContainer.appendChild(buttonContainer);
        
        this.get("element").insertBefore(navContainer, this.get("element").firstChild);
      
      
        if (calId !== null) {
                    
          cal = new YAHOO.widget.Calendar("navcal", calId, {close: true, navigator: true});
          
          cal.selectEvent.subscribe(this._doCalNav, this, true);
          cal.hide();
          cal.render();

          this._navCalendar = cal;
        }
        
                    
            
        // label for the date
        Dom.addClass(dayLabels, CLASS_DIARY_COLLABEL_CONTAINER);
        navContainer.appendChild(dayLabels);
        
        
        
        
        this._renderColumnLabels();
      
        Ev.on( left, "click" , this._doPrevious , this , true );
        Ev.on( right , "click" , this._doNext , this , true );
        Ev.on( today, "click" , this._doFirstDayOfTodaysWeek, this, true );
        Ev.on( view, "click" , this._changeView, this, true );
        
        this._renderTitle();
      
      },
      
      
      /**
       * @method _renderColumnLabels
       * @protected
       * @description Adds column headers and date labels, and click listeners
       */
      _renderColumnLabels : function() {
      
        var startDate = this.get("startDate"),
            labelEl = document.createElement("span"),
            thisLabel,
            paddEl,
            dayCounter = 0,
            dayLabels = Dom.getElementsByClassName( 
                CLASS_DIARY_COLLABEL_CONTAINER, 
                "div",
                this.getNavContainer()
            )[0];

        // remove whatever was there
        Ev.purgeElement(dayLabels);
        dayLabels.innerHTML = ''; 

        Dom.addClass( labelEl, CLASS_DIARY_COLLABEL);
        Dom.setStyle( labelEl, "width" , (this._colWidth - 4) + "px");
        
        if (this.get("display").format == "year") {
          paddEl = document.createElement("span");
          paddEl.innerHTML = "&nbsp;";
          Dom.setStyle(paddEl, "width", "50px");
          dayLabels.appendChild(paddEl);
        }

        // go through the days adding labels:
        for (dayCounter = 0; dayCounter < this.get("display").getDaysAcross; dayCounter += 1 ) {
            thisLabel = labelEl.cloneNode(false);
            thisLabel.innerHTML = this.renderDateLabel( startDate );
            dayLabels.appendChild(thisLabel);
            
            startDate = DM.add(startDate, DM.DAY, 1);
        }                        
      
      },
      
      
      /**
       * @method getNavContainer
       * @description Returns the container for the navigation els
       * @return {HTMLElement}
       */
      
      getNavContainer : function() {
        var con = Dom.getElementsByClassName( CLASS_DIARY_NAV, "div", this.get("element" ) );
        
        if( con === null || con === undefined || con.length === 0 ){
          return false;
        }
        return con[0];
      },
      
      
      /**
       * @method showNavCalendar
       * @description Shows the calendar navigator
       * @param ev {Event}  Event object; used to position.  Pass an object
       * with ev.clientX and ev.clientY to position the Calendar manually.
       */
      showNavCalendar : function(ev){
        var cal = this._navCalendar;
        
        cal.show();
        if (ev !== null && Lang.isNumber(ev.clientX) && Lang.isNumber(ev.clientY)) {
          Dom.setXY( cal.oDomContainer, [ ev.clientX - 200, ev.clientY ] );
        }
      },




      /**
       * @method _setDiaryPosition
       * @description Sets the height of the visible pane and scrollTop to 
       * show the correct segment of the Diary (e.g. 8am to 7pm)
       * @private
       */
      _setDiaryPosition: function() {
     
        var dayHeight, scrollTop, display = this.get("display");

        // set the style of the containers to get the height:
        
        dayHeight = display.getDiaryHeight + "px"; 
        Dom.getElementsByClassName( CLASS_DIARYDAY_CONTAINER, "div", this._calHolder, 
                                    function(n){Dom.setStyle( n, "height" , dayHeight); } );

        Dom.setStyle(this._calHolder, "height",(display.getDiaryHeight * Math.floor(display.getDaysInView/display.getDaysAcross)) + "px");
        
        scrollTop = display.getDiaryScrollTop; 
        this._calHolder.scrollTop = scrollTop;

        

      },
      
      /**
       * @method renderDateLabel
       * @description  Overwritable to render date labels at the top of each column.
       * Default is oDate.toString().substring(0, 10);
       * @param oDate {Date} Date object
       * @return {String}
       */
      renderDateLabel: function( oDate ) {
        var display = this.get("display");
        if ( Lang.isFunction(display.renderDateLabel)) {
          return display.renderDateLabel(oDate);
        }
        
        return oDate.toString().substring( 0, 10 );
      },
      
      
      /**
       * @method _renderTitle
       * @description  Puts the title text in the title container box
       * Doesn't actually produce the title string though.
       * @protected
       */
      _renderTitle: function(){
         var titleBox = Dom.getElementsByClassName(CLASS_DIARY_TITLE, "div", this.getNavContainer() );
         titleBox[0].innerHTML = this.renderTitle();
      },
      
      
      /**
       * @method renderTitle
       * @description  Overwriteable to render title string
       * Can use strftime identifiers in the format string
       * @param titleString {String}  Title string with strftime placeholders.
       * @return {String}
       */
      renderTitle: function( titleString ){
      
         if( titleString === undefined ) {
           titleString = this.get( "titleString" );
         }
         
         return YAHOO.util.Date.format(this.get("startDate"), { format: titleString }, this.get("locale") );
      
      },
      
      
      /**
       * @method renderItems
       * @description Renders the diary Items onto the Diary
       * @public
       */
      renderItems : function() {
        
        var displayFormat = this.get("display"),
            zeroTime = parseInt(this.get("startDate").getTime(), 10),
            limitTime =  zeroTime + displayFormat.getSeconds,
            i;
      
        for(i = zeroTime; i < limitTime ; i += 86400000 ) {
      
          if( this._diaryData[ i ] !== undefined ) {
             
             this._diaryData[ i ]._rebuildBlocks();
             this._diaryData[ i ].render();
          
          }
        
        }

         
      },
      
      
      
      
      /**
       * @method rebuildColumns
       * @description Goes through existing data and updates columns and blocks
       * - useful for visibility changes of items
       * @public
       */
      rebuildColumns : function () {
      
        var i = 0,
            dData = this._diaryData;

        for (i in dData) {
           if (dData[i]._rebuildBlocks !== undefined){
             dData[i]._rebuildBlocks();
             dData[i]._renderBlocks()
           }
        }
      
      },
      
      
      /**
       * @method _renderTooltip
       * @description Renders tooltip for showing full info
       * @protected
       */
      _renderTooltip: function(){
      
         if( this.get("tooltip" ) && YAHOO.widget.Tooltip !== undefined ){
         
           this._tooltip = new YAHOO.widget.Tooltip( this.get("element").appendChild( document.createElement("div") ), {
             showDelay: 300,
             hidedelay  : 500,
             disabled: true
           });
         
         }
      
      },
      
      
      
      /**
       * @method _renderFooter
       * @description Adds a footer element for status messages
       * @protected
       */
      _renderFooter : function() {
        var ftEl = document.createElement("div");
        
        Dom.addClass(ftEl, CLASS_DIARY_FOOTER);
        Dom.generateId(ftEl);
        
        this.appendChild(ftEl);
        
        this._footerEl = ftEl;
      },
      
      
      
      /**
       * @method _setFooter
       * @description Adds text to the footer element, and optionally hides
       * it after hideDelay.  Called onFooterStringChange.  
       * Animated opacity change if Anim is available.
       * @protected
       */      
      _setFooter : (function() {
       
           // Anon function keeps single anim object and work private, re-uses
           // anim
            var ftEl = this._footerEl,
                doTextChange,
                setText = function (text) {
                  ftEl.innerHTML = text;
                },
                anim = (Lang.isObject(YAHOO.util.Anim) ? new YAHOO.util.Anim(ftEl,{opacity:{to:1}}, 0.5) : false),
                fadeTimer;
            
            
            // Animated version
            if (anim) {
            
              doTextChange = function (text, fadeOut) {
                var animStartOpacity = ( fadeOut ? 1 : 0);
         
                Dom.setStyle(ftEl,"opacity",animStartOpacity);
                anim.attributes.opacity.to = (1 - animStartOpacity);
                anim.onComplete.unsubscribe(setText);
      
                if (animStartOpacity === 0){
                  setText(text)
                } else {
                  anim.onComplete.subscribe(setText, text);
                }

                anim.animate();
                
              }
            
            
            } else {
            
              // Plain version
              doTextChange =setText;
            
            }
       
       
            // The actual method that's set as _setFooter 
            return function() {
                var ftOb = this.get("footerString");
                
                ftEl = this._footerEl;

                // Stop previously set changes:
                if (fadeTimer) {
                  fadeTimer.cancel();
                  setText("");
                }
                
                if (anim) {
                  anim.setEl(ftEl);
                  anim.stop(true);
                }
                
                // chacks
                if (ftOb.text === undefined  || !Lang.isString(ftOb.text)) {
                  return;
                }
                
                // write the text (or fade it in)
                doTextChange(ftOb.text, ftOb.fadeOut);
                
                if (ftOb.hideDelay !== undefined && ftOb.hideDelay > 0) {
                  fadeTimer = Lang.later(ftOb.hideDelay, this, function () {
                                this.set("footerString", {text: "", fadeOut: true});
                              }, null, false);
                }        
            
          };
      }()),
      
      /**
       * @method _renderLoading
       * @description Adds a div with a 'loading' class to indicate data's on 
       * it's way.  
       * @TODO Sort out - messes with navigation currently...
       */
      _renderLoading : function() {
      return;
       /* var elId;
      
        if(this._loadingElId === '') {
          elId = Dom.generateId();
          this.getNavContainer().innerHTML += "<div class='" + CLASS_DIARY_LOADING + ' ' + CLASS_DIARY_LOADING_HIDDEN + "' id='" + elId + "'>loading data...</div>";
          this._loadingElId = elId;
        } else {
          elId = this._loadingElId;
        }
        
        if (Dom.hasClass( elId, CLASS_DIARY_LOADING_HIDDEN )) {
          Dom.removeClass(elId, CLASS_DIARY_LOADING_HIDDEN);
        } else {
          Dom.addClass(elId, CLASS_DIARY_LOADING_HIDDEN);
        }
      */
      
      },
      
      
      /**
       * @method _reFormat
       * @protected
       * @description Called on formatChange to alter start/end time window
       * or day/week/month to view.
       */
      _reFormat : function (ev) {

        // change view
        if (ev.prevValue.format !== ev.newValue.format) {
           
          // remove the previous css class added to the container
          this.removeClass( CLASS_DIARY_DISPLAY[ ev.prevValue.format.toUpperCase() ] );
          // setup the new one:
          this._setViewFormat(ev.newValue.format);
        
        } 
        
        if (ev.prevValue.startTime !== ev.newValue.startTime || 
            ev.prevValue.endTime !== ev.newValue.endTime) {

          this._setDiaryPosition();
        }
      
      },
      
      
      /**
       * @method _setViewFormat
       * @protected
       * @description Sets week/day/month view
       * @param format {String} type of view
       */
      _setViewFormat : function (format) {
       
        var newDataNeeded = (format != "day");
        
        // set the new col width
        this.set("scaleColumns", this.get("scaleColumns"), true);

        if (format !== "month" && format !== "year") { 
        
          this.unlock(true, false);
          Dom.getElementsByClassName(CLASS_DIARY_ITEM, "div", this.get("element"), 
                                     function (n) {Dom.removeClass(n, CLASS_DIARY_ITEM_MONTHVIEW);});
        }
        if (format == "year") {
          this.setStyle("line-height", "20px");
        } else {
          this.setStyle("line-height", null);
        }
        
        this._reDo(newDataNeeded);
      },
      
      

      
      /**
       * @method lock
       * @description Locks resize and/or drag-drop for all currently existing
       * DiaryItems.
       * @param lockResize {Boolean}
       * @param lockDragDrop {Boolean}
       *
       */
      lock: function (lockResize, lockDragDrop) {
      
        var i,
            items = this._itemHash;
      
        if (!lockResize && !lockDragDrop) {
          return;
        }
        

        if (lockResize) {
          this._lockResize = true;
        }
        if (lockDragDrop) {
          this._lockDragDrop = true;
        }
     
        for (i in items) {
          if (Lang.isFunction(items[i].lock)) {
            if (lockResize) {
              items[i].lock();
            }
            if (lockDragDrop && items[i].dragdrop !== null && Lang.isFunction(items[i].dragdrop.lock)) {
              items[i].dragdrop.lock();
            }
          }
        } 
      
      },

      
      /**
       * @method unlock
       * @description Unlocks resize and/or drag-drop for all currently existing
       * DiaryItems.
       * @param unlockResize {Boolean}
       * @param unlockDragDrop {Boolean}
       *
       */      
      unlock: function (unlockResize, unlockDragDrop) {
      
        var i,
            items = this._itemHash;
      
        if (!unlockResize && !unlockDragDrop) {
          return;
        }

        if (unlockResize) {
          this._lockResize = false;
        }
        if (unlockDragDrop) {
          this._lockDragDrop = false;
        }
     
        
        for (i in items) {
          if (Lang.isFunction(items[i].unlock)) {
            if (unlockResize) {
              items[i].unlock();
            }
            if (unlockDragDrop && items[i].dragdrop !== null && Lang.isFunction(items[i].dragdrop.unlock)) {
              items[i].dragdrop.unlock();
            }
          }
        } 
      
      },
      
      /**
       * @method addItemFilter
       * @description Filters DiaryItems based on css selector.
       * selector passed will be appended directly to ".lplt-diary-item"
       * If nothing is passed, it will filter for all (ie hide everything)
       * @param selector {String}
       * @return {Int}  Number of items hidden
       */
      addItemFilter : function (selector) {
      
        YAHOO.log( "Diary.addItemFilter" , "info" );        
 
        var i, 
            items = Selector.query("." + CLASS_DIARY_ITEM + selector, this.get("element"));

        for( i = 0; i < items.length; i++ ){

             Dom.addClass( items[i], CLASS_DIARY_ITEM_HIDDEN);
             this._itemHash[items[i].id].set("visible", false);

        }
        this._filters[ selector ] = true;

        // make remaining ones wider:
        this.rebuildColumns();
        
        return i;
      
      },
      /**
       * @method removeItemFilter
       * @description Removes filter on DiaryItems based on css selector.
       * selector passed will be appended directly to ".lplt-diary-item"
       * If nothing is passed, it will filter for all (ie show everything)
       * @param selector {String}
       * @return {Int} Number of items shown
       */      
      removeItemFilter : function (selector) {
        var i,
        f, 
        items = Selector.query("." + CLASS_DIARY_ITEM + selector, this.get("element") ),
        itemsToRemoveFilter = false,
        remainingFilters = [];

        // remove this filter from memory.
        this._filters[ selector ] = undefined;
        
        // Now build a test selectors based on remaining filters applied:
        for (f in this._filters) {
          if( Lang.isString(f) && this._filters[f] === true ){
             remainingFilters.push("." + CLASS_DIARY_ITEM + f);
          }
        }
        if (remainingFilters.length > 0 ) {
          itemsToRemoveFilter = remainingFilters.join(", ");
        } 


        // loop through items that matched the given selector,
        // but check that they shouldn't still be hidden because of other
        // filters applied
        for( i = 0; i < items.length; i++ ){
          if (itemsToRemoveFilter === false) {
            Dom.removeClass(items[i], CLASS_DIARY_ITEM_HIDDEN);
            this._itemHash[items[i].id].set("visible", true);
          } else if ( !Selector.test(items[i], itemsToRemoveFilter)) {
            Dom.removeClass(items[i], CLASS_DIARY_ITEM_HIDDEN);
            this._itemHash[items[i].id].set("visible", true);
          }
          
        }
        
        // make remaining ones smaller:
        this.rebuildColumns();
        
        return i;      
      },
      
      
      /**
       * @method toggleItemFilter
       * @description Toggles an item filter
       * @public
       * @param selector {String}
       * @return {Int} Number of items shown/hidden: positive => shown; negative 
       * value => hidden
       */
      toggleItemFilter : function(selector) {

        if (this._filters[ selector ] !== undefined) {
          return this.removeItemFilter(selector);
        } else {
          return -1 * this.addItemFilter(selector);
        }
      
      },
      
      /**
       * @method _applyFilters
       * @description  Re-applies all filters currently in place.
       * Called internally when navigating to keep existing filters in place
       * @protected
       */
      _applyFilters: function(){
        var i,filters = this._filters;
        
        for( i in filters ){
          if( Lang.isString( i ) && filters[ i ] === true ){
            this.addItemFilter( i );
          }
        }
        
      },

      /**
       * @method _applyFiltersToElement
       * @description  Re-applies all filters to the element passed.
       * Called internally when navigating to keep existing filters in place.
       * @param HTMLElement
       * @protected
       */      
      _applyFiltersToElement : function(el) {
        var i,
            filters = this._filters;
        
        for (i in filters) {
          if(Lang.isString(i) && filters[i] === true && Selector.test(el, i)) {
            Dom.addClass(el, CLASS_DIARY_ITEM_HIDDEN);
          }
        }      
      },




      /**
       * @method destroy
       * @description destroys the Diary
       */
      destroy : function() {
      
        this._destroyData();
        this._destroyDays();
        this._removeListeners();
        
        // other widgets:
        if (this._tooltip) {
          this._tooltip.destroy();
          this._tooltip = null;
        }
        if (this._navCalendar) {
          this._navCalendar.destroy();
          this._navCalendar = null;
        }
        
        this.removeClass( CLASS_DIARY_CONTAINER );
        this.get("element").innerHTML = "";
        
        this._ds = null;
        delete this._ds;
        
        /**
         * @event destroy
         * @description When the Diary has finished destorying
         */
        this.fireEvent("destroy");
      
      },


      /**
       * @method _destroyData
       * @description  Clears out existing data
       * @protected
       */
      _destroyData: function(){
      
        var i;

        for( i = 0; i < this._diaryData.length; i++ ){
          this._diaryData[i].destroy();
        }
 
        for (i in this._itemHash) {
          if (Lang.isFunction(this._itemHash[i].destroy)) {
            this._itemHash[ i ].destroy();
            delete this._itemHash[i];
          }
        }
        
        this._itemHash = [];
        this._diaryData = [];
        this._colToDayMap = {};
        /**
         * @event destroyData
         * @description After all the data has been destroyed.
         */
        this.fireEvent( "destroyData" );

      
      },
      
      /**
       * @method _destroyDays
       * @description  Destroys the days rendered in the diary
       * @protected
       */
      _destroyDays: function(){
        //Ev.purgeListeners( this._calHolder );
        this.get("element").removeChild( this._calHolder );
      },
      
      
      /**
       * @method _removeListeners
       * @description Removes event listeners
       * @protected
       */
      _removeListeners : function() {
      
        // listeners on the main element (delegated)
        Ev.purgeElement(this.get("element"), false);
        // navigation event listeners (recurse: not too deep and need to pick up
        // all the nav buttons
        Ev.purgeElement(this.getNavContainer(), true);
        
      
      },
      
      
      /**
      * Returns a string representation of the object.
      * @method toString
      * @return {String} The string representation of the Diary
      * @private
      */      
      toString : function() {
        return "Diary " + this.get("element").id;
      }
      
      




        /** 
         * @event itemBeforeStartMove
         * @description Fired before everything starts moving.  Return false to cancel move.
         * @param oArgs.item   DiaryItem that's about to be moved.
         */  
        /**
         * @event itemBeforeEndMove
         * @description fired when an item is moved or resized (ie the times change).
         * Return false to cancel the resize/move
         * @param oArgs.from   Object literal containing original DTSTART and DTEND
         * @param oArgs.to     Object literal containing final DTSTART and DTEND
         * @param oArgs.item   DiaryItem that's being moved
         * @param oArgs.originEvent    Original event from resize/dragdrop passed through.
         */

        /**
         * @event itemEndMove
         * @description fired when an item is moved or resized (ie the times change)
         * @param oArgs.from   Object literal containing original DTSTART and DTEND
         * @param oArgs.to     Object literal containing final DTSTART and DTEND
         * @param oArgs.item   DiaryItem that's being moved
         * @param oArgs.originEvent    Original event from resize/dragdrop passed through.
         */
  });
  
  
  YAHOO.widget.Diary = Diary;


// Bug in Selector: breaks filtering in IE7
if(YAHOO.env.ua.ie && ((!document.documentMode && YAHOO.env.ua.ie<8) || document.documentMode < 8)){// rewrite class for IE < 8
    YAHOO.util.Selector.attrAliases['class'] = 'className';
    YAHOO.util.Selector.attrAliases['for'] = 'htmlFor';
}
 
      
})();
YAHOO.namespace( "widget" );
YAHOO.register("diary", YAHOO.widget.Diary, {version: "1.4", build: "016"});