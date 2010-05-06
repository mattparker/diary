/*
Copyright (c) 2010, Lamplight Database Systems Limited, http://www.lamplightdb.co.uk
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 1.0
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
 * Diary uses a YAHOO.util.Datasource with, minimally, start and end dates.
 * Items in the diary can be rescheduled using drag and drop, or times changed using resize.
 * New items can be added by click-and-dragging on the diary to provide the 
 * start and end times.
 *
 */
(function () {


    var Dom = YAHOO.util.Dom,
        Ev  = YAHOO.util.Event,
        DM  = YAHOO.widget.DateMath,
        Lang = YAHOO.lang,
      
      
      
        PX_PER_HOUR = 20,
     
     
     
  /**
   *
   * DiaryItem class for individual items in the Diary.
   *
   * Data and display for particular diary item.
   * Extends resize (and includes drag drop).  This class shouldn't be used
   * directly; items to be added should be added by the Diary.addItem() method.
   *
   * @class DiaryItem
   * @extends YAHOO.util.Resize
   * @param elContainer {HTMLElement | String} Container for the DiaryItem
   * @param oCfg {Object}  Object literal of configuration values.  oCfg.DTSTART and oCfg.DTEND are required.
   *
   */
  DiaryItem = function (el, oCfg) {

     
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
        oCfg.yTicks = parseInt(PX_PER_HOUR / 4, 10);


        // add a drag drop separately
        if (oCfg.enableDragDrop) {
            var dd = new YAHOO.util.DD(el, "default", {isTarget: false});
            this.dragdrop = dd;
        } else {
            this.dragdrop = false;
        }
     
     
        this._multiDayChildren = [];
     
        YAHOO.log("constructor for new DiaryItem ", "info");     
     
        DiaryItem.superclass.constructor.call(this, el, oCfg);

        if (this.dragdrop) {
            this.dragdrop.setYConstraint( 
                this.calculateTop(), 
                parseInt((24 * PX_PER_HOUR) - (this.calculateTop() / 3600), 10), 
                oCfg.yTicks 
            );
        }
     
        // default no animation initially
        this.anim = false;

     


        this.initContent();
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
       * @property _cacheDates
       * @private
       * @default: []
       * @type Array
       */
      _multiDayChildren: [],
      
      
      /**
       * Implementation of Element's abstract method. Sets up config values.
       *
       * @method initAttributes
       * @param oConfigs {Object} Object literal definition of configuration values.
       * @private
       */
      initAttributes : function(oCfg){

         
         DiaryItem.superclass.initAttributes.call(this, oCfg);
         


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
           validator: Lang.isString
         
         });
         
         /**
          * @attribute backClass
          * @description Adds css class(es) to the text div container Item container
          * @type String class name to add
          * @default ""
          */         
         this.setAttributeConfig('detailClass', {
         
           value: '',
           validator: Lang.isString
         
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
         


     
      },
      
      
      /**
       * @description Initializer, sets up the details Element
       *
       * @method initContent
       */
      initContent: function() {

        var detailsEl = document.createElement("div");
        Dom.addClass(detailsEl, "lplt-diary-item-details");
        Dom.addClass(detailsEl, this.get("detailClass"));
        this.get("element").appendChild(detailsEl);
        Dom.addClass(this.get("element"), this.get("backClass"));

        this._detailsEl = detailsEl;
      
      },
      
      
      
      /**
       *
       * @description Initialize listeners for this item.
       *
       * @method initListeners
       */
      initListeners: function() {

        this.on("startResize",this._handleBeforeStartDrag, this, true);
        this.on("startResize", this._handleDiaryStartDrag, this, true);
        this.on("endResize", this._handleDiaryEndDrag, this, true);
        this.on("resize", this._handleDiaryDragOver, this, true);

        this.on("SUMMARYChange", this.renderDetails , this, true);
        this.on("DTSTARTChange", this.renderDetails, this, true);
        this.on("DTENDChange", this.renderDetails, this, true);
       
        if (this.dragdrop) {
          this.dragdrop.on("b4StartDragEvent" , this._handleBeforeStartDrag, this, true);
          this.dragdrop.on("startDragEvent", this._handleDiaryStartDrag, this, true);
          this.dragdrop.on("endDragEvent", this._handleDiaryEndDrag, this, true);
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
      _handleBeforeStartDrag: function(ev) {
        /**
         * @event itemBeforeStartMove
         * @description Fired before everything starts moving.  Return false to cancel move.
         * @param oArgs.item   DiaryItem that's about to be moved.
         */
        if (false === this.getDiary().fireEvent("itemBeforeStartMove", {item: this})) {
           YAHOO.util.DDM.stopDrag();
           YAHOO.util.DDM.stopEvent();
           this._handleDiaryEndDrag();
           return false;
        }
      },
      
      
      /**
       * Start dragging handler.  Caches dates, sets Anim if needed.
       * @method _handleDiaryStartDrag
       * @protected       
       */
      _handleDiaryStartDrag: function() {
 
        this._cacheDates = {
           startTimeDay: this.getStartTimeDay(),
           DTSTART: new Date(this.get("DTSTART")),
           DTEND: new Date(this.get("DTEND"))
        };
        
        Dom.setStyle(this.get("element"), "z-index", 2);

        if (YAHOO.util.Anim !== undefined && 
            this.anim === false && 
            this.get("useAnimation") === true) {
           
              this.anim = new YAHOO.util.Anim(this.get("element") ,{} ,0.5 );
              
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
  
        // change the start times if this is a one-day item, 
        //or the start of a multi-day item
        if (this.get( "multiDayPosition" ) === false || 
            this.get( "multiDayPosition" ) == "first") {
              
              this.getParentItem().setStartTimeSecs(this.calcStartFromPosition());
              
        }
        // change the end times if this is a one-day item, or the end of a multi-day item
        if (this.get( "multiDayPosition" ) === false || 
            this.get( "multiDayPosition" ) == "last") {
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
      _handleDiaryEndDrag: function(ev) {
      
        var startTimeDay, element, endCol, el,
            startCol = this.get("column"),
            diary = this.getDiary(),
            cache = this._cacheDates,
            cacheStart = cache.DTSTART ,
            cacheEnd   = cache.DTEND ;
      
        this.dragdrop.lock();

        /**
         * @event itemBeforeEndMove
         * @description fired when an item is moved or resized (ie the times change).
         * Return false to cancel the resize/move
         * @param oArgs.from   Object literal containing original DTSTART and DTEND
         * @param oArgs.to     Object literal containing final DTSTART and DTEND
         * @param oArgs.item   DiaryItem that's being moved
         * @param oArgs.originEvent    Original event from resize/dragdrop passed through.
         */

        if( false === diary.fireEvent( "itemBeforeEndMove" , { 
                from : { DTSTART: cacheStart , 
                         DTEND : cacheEnd 
                },
                to: { DTSTART: this.get( "DTSTART" ),
                      DTEND  : this.get( "DTEND" ) 
                }, 
                item: this,
                originEvent: ev } 
               ) ) {
           
             // reset dates to where they started from:
             this.set( "DTSTART" , cacheStart );
             this.set( "DTEND", cacheEnd );
           
        } else {
        
            
            // change the times
            if( this.get( "multiDayPosition" ) === false || this.get( "multiDayPosition" ) == "first" ){
              this.getParentItem().setStartTimeSecs( this.calcStartFromPosition() );
            }
            if( this.get( "multiDayPosition" ) === false || this.get( "multiDayPosition" ) == "last" ){
              this.getParentItem().setEndTimeSecs( this.calcEndFromPosition() );
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
        
        // final tidying up
        this._cacheDates = {};
        this.dragdrop.unlock();
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
        var r = ( this.get( "DTSTART" ).getHours() * 3600 );
				 r += ( this.get( "DTSTART" ).getMinutes() * 60 );
				 r += ( this.get( "DTSTART" ).getSeconds() );
				 return r;
      },
      
      
      /**
       * @method getEndTimeSecs
       * @description Gets the end time as seconds from 00:00
       * @return {Int}
       */
      getEndTimeSecs: function(){
        var r = ( this.get( "DTEND" ).getHours() * 3600 );
				r += ( this.get( "DTEND" ).getMinutes() * 60 );
				r += ( this.get( "DTEND" ).getSeconds() );
				return r;
      },


      
      
      /**
       * @method getDisplayStartTimeSecs
       * @description Gets the displayed start time as seconds from 00:00
       * @protected
       * @return {Int}
       */
      getDisplayStartTimeSecs: function(){
        var r = ( this.get( "_displayDTSTART" ).getHours() * 3600 );
				r += ( this.get( "_displayDTSTART" ).getMinutes() * 60 );
				r += ( this.get( "_displayDTSTART" ).getSeconds() );
				return r;
      },
      
      
      /**
       * @method getDisplayEndTimeSecs
       * @description  Gets the displayed end time as seconds from 00:00
       * @protected
       * @return {Int}
       */
      getDisplayEndTimeSecs: function(){
        var e = ( this.get( "_displayDTEND" ).getHours() * 3600 );
				e += ( this.get( "_displayDTEND" ).getMinutes() * 60 );
				e += ( this.get( "_displayDTEND" ).getSeconds() );
				return e;
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
       * @param {Int}
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
      
        return ( ( this.getDisplayEndTimeSecs() - this.getDisplayStartTimeSecs() ) * ( PX_PER_HOUR /3600)  - 2);
      
      },

      /**
       * @method calculateTop
       * @description Calculate the top (in pixels) of this based on times
       * @return {Int}
       */      
      calculateTop: function(){
        return ( ( this.getDisplayStartTimeSecs() ) * ( PX_PER_HOUR / 3600) );
      },

      /**
       * @method calcStartFromPosition
       * @description Calculate the start time (seconds) based on position
       * @return {Int}
       */      
      calcStartFromPosition: function( t ) {
         if( t === undefined ) {
           t = parseInt( this.getStyle("top") , 10 );
         }   
         return parseInt( ( ( t * 3600 ) / PX_PER_HOUR ), 10 );
      
      },

      /**
       * @method calcEndFromPosition
       * @description Calculate the end time (seconds) based on position
       * @return {Int}
       */        
      calcEndFromPosition: function( h , t) {
      
         if( h === undefined ){
           h = parseInt(this.getStyle("height"),10);
         }
         if( t === undefined ) {
           t = parseInt( this.getStyle("top") , 10 );
         }
      
         return parseInt( ( ( ( h + t ) * 3600 ) / PX_PER_HOUR ), 10 );
      
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
        var lineWidth = parseInt( ( ( oDetails.width  - 20 )/ oDetails.linesInBlock ), 10 ),
            w = (lineWidth - 4 ),
            l =  parseInt( ( ( this._line ) * lineWidth ) + 20 , 10 ),
            t = parseInt( this.calculateTop() , 10 ),
            h = parseInt( this.calculateHeight() , 10 );

             
        this.renderDetails( false );
        
        
        this.setStyle( "top" , t + "px");
        this.setStyle( "left" , l + "px" );
        
        if( this.anim === false ) {
          this.setStyle( "width" , w + "px" );
          this.setStyle( "height" , h + "px");
          Dom.setStyle( this._detailsEl, "height", h + "px");

        } else {
          this.anim.attributes = {  height: { to: h }, width: { to : w } };
          this.anim.animate();
        }
        this.addClass( "lplt-diary-item" );


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
            shortText =  item.renderStartTime() + ' - ' + item.renderEndTime() + ': ' + item.get("SUMMARY") ; 
        
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
       * @param DiaryItem
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
     * { startSecs: 123, endSecs: 456 }
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
     * @param DiaryItem
     */
    addItem: function(item) {
    
      // which vertical line will this sit in?
      var line = this._findLineForItem(item);
      // add a new one if needed
      if( line === false ) {
        this._lines.push({startSecs: item.getDisplayStartTimeSecs(),
                          endSecs : item.getDisplayEndTimeSecs()});
        line = this._lines.length - 1;
      } else {
        this._lines[line].startSecs = Math.min(this._lines[line].startSecs, 
                                               item.getDisplayStartTimeSecs());
        this._lines[line].endSecs = Math.max(this._lines[line].endSecs, 
                                             item.getDisplayEndTimeSecs());
      }
      item.setLine( line );
    
      // store the item
      this._items.push( item );
      
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
     * @param DiaryItem
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
      var i;
      
      for( i = 0; i < this._items.length; i++ ) {
        this._items[ i ].render( {linesInBlock: this._lines.length, 
                                  width: oCfg.width || 150 });
      }
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
    Dom.addClass( dataEl , "lplt-diary-datacontainer" );
    this.get("element").appendChild( dataEl );
    this._dataEl = dataEl;

    var backgroundEl = document.createElement( "div" );
    backgroundEl.id = "bdy-" + el.id.substring( 4 );
    this.get("element").appendChild( backgroundEl );
    this._backgroundEl = backgroundEl;    


    // Make the background a DDTarget
    var ddt = new YAHOO.util.DDTarget( backgroundEl , "default" );
    
    // Store a ref to this day so we know on drag drop where we are easily
    ddt._diaryDay = this;
    this.ddTarget = ddt;
    
  };
  

  DiaryDay.prototype.toString =  function(){
       return "DiaryDay item " + oDay;
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
     _addItemToBlock: function( item ){
       
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
      * @param DiaryItem
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
         allItems.sort( Diary.prototype._itemSorter);
         
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
       this._renderColumn();
       
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
            backgroundEl = this._backgroundEl,
            containerEl = document.createElement( "div" ),
            baseEl = document.createElement( "div" );
        
        // container:
        Dom.addClass( containerEl , "lplt-diaryday-container" );
        
        // container for background:
        Dom.addClass( backgroundEl, "lplt-diary-background" );
       
        Dom.addClass( baseEl , "lplt-diary-hourblock" );
        Dom.setStyle( baseEl, "height" , PX_PER_HOUR - 1 );
        
        
        // add times
        for( h = 0; h < 24; h++ ){
          
          newEl = baseEl.cloneNode( false );
          newEl.innerHTML =( h <= 12 ? h + "am" : (h-12) + "pm" );
          Dom.addClass( newEl, "h" + h );
          backgroundEl.appendChild( newEl );
          
        }
        
        containerEl.appendChild (  backgroundEl );
        containerEl.appendChild( this._dataEl.parentNode.removeChild( this._dataEl ) );
        parent.appendChild ( containerEl );

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
     }
  
  });
  
  
  
  
  
  
  
  /**
   *
   * The main diary; 
   *
   * This is the main object:
   *  - gets the data
   *  - does the main background display
   *  - sets up the DiaryDay objects and calls their render methods
   *  - holds delegated event listeners
   *
   * @namespace YAHOO.widget
   * @class Diary
   * @extends YAHOO.util.Element
   * @constructor
   * @param el {HTMLElement} Container element for the Diary
   * @param oDS {YAHOO.util.DataSource} DataSource instance.
   * @param oCfg {Object} Object literal of config values.
   *
   */
  var Diary = function( el, oDS, oCfg ){

    Diary.superclass.constructor.call( this, el, oCfg);

    this.setupDays();
    this.initListeners();
    
    this.initData(el, oCfg, oDS );

  };
  
  
	Lang.extend( Diary, YAHOO.util.Element, {
  
     /**
      * @property _colToDayMap
      * @type Array
      * @description provieds a map from columns id's to dates (in seconds)
      * @protected 
      */
     _colToDayMap:[],
     
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
      * @property _diaryData
      * @type Array
      * @description Array holding DiaryItem element ids and DiaryItem refs
      * @protected
      */
      _itemHash: [],
      

     /**
      * @property _filters
      * @type Object
      * @description Object of filters currently applied
      * @protected
      */
      _filters: {},


     /**
      * @method initAttributes
      * @param Object
      * @description Object of filters currently applied
      * @private
      */
     initAttributes: function( oCfg ){
 
        Diary.superclass.initAttributes.call( this, oCfg );

           /**
            * @attribute endDate
            * @description Final date currently displayed on Diary
            * @type {Date} (Optional)
            * @default 7 days on from startDate
            */
           this.setAttributeConfig( 'endDate' );
           

           /**
            * @attribute startDate
            * @description When to start the diary display from
            * @type {Date}
            */
           this.setAttributeConfig( 'startDate' , {
             method: function(v){
               this.set("endDate", DM.add( v, DM.DAY, 7 ));
             }
           });
    			 

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
            * @description Whether to scale columns to width
            * @type Boolean
            * @default true
            */			 
          this.setAttributeConfig( 'scaleColumns' , {
            
            validator: Lang.isBoolean,
            value: true,
            method: function(v){
              if( v && this.get( "width" ) ){
                this._colWidth = this.get( "width" ) / 8; // ( 7 days / week )
              } else {
                this._colWidth = 200;
              }
            }
             
            } 
    			 );
    			 
    			 
    			 /**
    			  * 
    			  */
           /**
            * @attribute display
            * @description Display formats: object literal with format 
            * and start and end times (in 24-hour clock hours) displayed
            * in the main window (the rest are above and below the scroll.
            * <pre>{ format: "week", startTime: 8, endTime: 20 }</pre>.
            * The only format available currently is "week".
            * @type Object
            * @default <pre>{ format: "week", startTime: 8, endTime: 20 }</pre>
            */	
           this.setAttributeConfig( 'display' , {
             value:  { format: "week" , startTime: 8, endTime: 20 }
            } 
    			 );
    			 			 
    
    
    			 
           /**
            * @attribute calenderNav
            * @description Whether to use a YAHOO.widget.Calendar in the navigation.
            * @type Boolean
            * @default true
            */			 
           this.setAttributeConfig( 'calenderNav', {
             validator: Lang.isBoolean,
             value: true
           });
           
           

           /**
            * @attribute fieldMap
            * @description  Field map, mapping keys of DataSource to expected 
            * keys of data for DiaryItems.  DiaryItem keys are the keys in the 
            * object passed; values are the names of the fields in the DataSource.
            * backClass is the css class string applied to the background container of the
            * DiaryItem; detailClass is the css class string applied to the element
            * holding the text of the item.  These can be used by addItemFilter
            * to show or hide items by category.
            *
            * @type {Object}
            * @default <pre> 
             &nbsp;        { DTSTART: "DTSTART",
             &nbsp;          DTEND:   "DTEND",
             &nbsp;          SUMMARY: "SUMMARY",
             &nbsp;          DESCRIPTION: "DESCRIPTION",
             &nbsp;          URL: "URL",
             &nbsp;          backClass: "backClass",
             &nbsp;          detailClass: "detailClass" }</pre>
            */	
            this.setAttributeConfig( 'fieldMap' , {
            
              value: { DTSTART: "DTSTART",
                       DTEND:   "DTEND",
                       SUMMARY: "SUMMARY",
                       DESCRIPTION: "DESCRIPTION",
                       URL: "URL",
                       backClass: "backClass",
                       detailClass: "detailClass" },
              setter: function( oMap ){
              
                return Lang.merge( { DTSTART: "DTSTART",
                       DTEND:   "DTEND",
                       SUMMARY: "SUMMARY",
                       DESCRIPTION: "DESCRIPTION",
                       URL: "URL",
                       backClass: "backClass",
                       detailClass: "detailClass" }, oMap );
              
              }
            
          
          } );
  			 

           /**
            * @attribute titleString
            * @description String to use as template for title.  You can use 
            * strftime type identifiers.
            * @type String
            * @default "Diary w/c %A, %e %B %Y"
            */	
           this.setAttributeConfig( "titleString" , {
             validator: Lang.isString,
             value: "Diary w/c %A, %e %B %Y"
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
           * @description  Whether to use tooltip for mouseover events to show details
           * @default: false
           * @type Boolean
           */ 
           this.setAttributeConfig( "tooltip", {
             validator: Lang.isBoolean,
             value: false
           });        
                  
          
   
          /**
           * @attribute animate
           * @description  Whether to use animation when moving items around
           * @default: false
           * @type Boolean
           */ 
           this.setAttributeConfig( "useAnimation", {
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
       
          this.on( "parseData" , this.render, this );
          
          // click and drag new items
          Ev.delegate( this.get("element") , "mousedown", this._startNewItem , "div.lplt-diary" , this , true );
          
          // click on existing diary items
          Ev.delegate( this.get("element"), "click" , this.handleItemClick , "div.lplt-diary-item", this, true);
          
          // mouseover
          Ev.delegate( this.get("element"), "mouseenter", this.handleItemMouseEnter, "div.lplt-diary-item", this, true);
       
       },



       /**
        * @method setupDays
        * @description Display days of the week holders
        * @protected
        */
       setupDays: function() {
      
         YAHOO.log("Diary.setupDays" ,"info" );
      
         var calHolder = document.createElement( "div" );


        
         Dom.addClass( calHolder, "lplt-diary" );
         this._calHolder = calHolder;
         this.get("element").appendChild(calHolder );
                
          var i, j = 0, parent = calHolder,
              dayEl = document.createElement( "div" ),
              newDayEl , 
              zeroTime = parseInt( this.get("startDate").getTime(), 10 ),
              day;
  
          
          
          dayEl.className = "lplt-diary-day";
          
          // loop through from start to end adding a new DiaryDay for each
          for( i = zeroTime ; i < zeroTime + 604800000 ; i += 86400000 ) {
        
            newDayEl = dayEl.cloneNode(true);
            j = Dom.generateId( newDayEl , 'day-' ).substring( 4 );
            
            day = new Date( i );
            this._diaryData[ i ] = new DiaryDay( newDayEl, { coldate: day , diary: this , width: this._colWidth }  );
        
            parent.appendChild( newDayEl );
            this._colToDayMap[j] = i;
        
                    
          }
       },
       
       
       /**
        * @method setupDays
        * @description Get the DiaryDay object based on date ( in seconds)
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
        * @param {Event}
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
           
           if( ( Dom.hasClass( target, "lplt-diary-item" ) || 
                 Dom.getAncestorByClassName(target, "lplt-diary-item" ) ) && 
                 !this.get( "itemClickCreateNew" ) ){
             return;
           }
  
           // only start a new one if previous ones have finished:
           if( this._selector.selectorDiv === undefined || this._selector.selectorDiv === null ){ 
  
            el = this._calHolder;
            sel = this._selector;
  
           // column we're over:
  				  dayEl = Dom.getAncestorByClassName( Ev.getTarget(ev), "lplt-diary-day" );
  				  if( dayEl === null || dayEl === undefined ){
  				    return;
  				  }
  				  sel.dayNumber = dayEl.id.substring( 4 );
  
     
             Ev.addListener( el , 'mousemove', this._resizeSelectorDiv , this, true );
             Ev.addListener( el , 'mouseup' , this._endSelector , this, true );
             
             x = Ev.getPageX( ev );// ev.clientX;
    				 y = Ev.getPageY( ev ); //ev.clientY;
    				 
    				 sel.startX = x;
    				 sel.startY = y;
    				 
    				 div = document.createElement( 'div' );
    				 Dom.addClass( div, "lplt-diary-selector" );
    				 Dom.setStyle( div, 'left' , x + 'px' );
    				 Dom.setStyle( div, 'top' , y + 'px' );
    				 Dom.setStyle( div, 'width' , '0px' );
    				 Dom.setStyle( div , 'height' , '0px' );

    
   				 
    				 sel.selectorDiv = div;
    				 // append to the data el
    				 Dom.getElementsByClassName("lplt-diary-datacontainer", 
                                        "div", dayEl, 
                                        function(n) {n.appendChild(div);} );

    				 Ev.stopEvent(ev);
  				}
  				 
       },
       
 
     
     /**
      * @description Resizes the selector when creating a new item
      * @method _resizeSelectorDiv
      * @protected
      * @param {Event}
      */    
     _resizeSelectorDiv: function( ev ){
     
        var x = Ev.getPageX( ev );// ev.clientX;
        var y = Ev.getPageY( ev );//ev.clientY;
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
      * @param event
      */
     _endSelector: function(ev){

        
        YAHOO.log( "Diary._endSelector " , "info");
        
            // start day of new item
        var itemDay = this._colToDayMap[ this._selector.dayNumber ], 
            // date object of new item
            itemStartDate = new Date( itemDay ), 
            // final day of new item
            finalDayEl = Dom.getAncestorByClassName( Ev.getTarget(ev), "lplt-diary-day" ),
            // final day id and date
            finalDayNumber = ( finalDayEl ) ? finalDayEl.id.substring( 4 ) : 0,
            finalItemDay = this._colToDayMap[ finalDayNumber ],
            // end date is either same day or where the mouse-upped
            itemEndDate = new Date( ( this.get("allowCreateMultiDayItems" ) ? finalItemDay : itemDay ) ),
            // work out times from mouse positions
            regionT = parseInt( Dom.getRegion( this._diaryData[ itemDay ]._backgroundEl ).top , 10 ),
            t = Math.abs( parseInt( Dom.getStyle( this._selector.selectorDiv, "top" ) , 10 ) - regionT ),
            h = parseInt( Dom.getStyle( this._selector.selectorDiv, "height" ), 10 ),
            // the new DiaryItem
            newItem,
            // tidies up after the item's been created
            cleanUp = function( ob ){
                Ev.purgeElement( ob._calHolder, false, 'mousemove' );
                Ev.purgeElement( ob._calHolder, false, 'mouseup' );
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
            
            // get start times
            var tSecs = DiaryItem.prototype.calcStartFromPosition( t ),
            hSecs = DiaryItem.prototype.calcEndFromPosition( h, t ),
            itemCfg = { DTSTART: 0 , DTEND: 0 , SUMMARY: '' },
            startHours = Math.floor( tSecs / 3600 ),
            startMins = Math.floor( (tSecs - ( startHours * 3600 ) ) / 60 ),
            endHours = Math.floor(  hSecs / 3600 ),
            endMins = Math.floor( ( (  hSecs ) - ( endHours * 3600 ) ) / 60 );
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
        
        }
        


        
     },
     
     
     
     /**
      * @description Add an item to the Diary
      * @method addItem
      * @param Object      Data for the new item, minimally: {DTSTART: oDate, DTEND: oDate }
      * @param Boolean     Whether to redraw once it's added
      * @return {DiaryItem}  The new item created
      */
     addItem: function( oCfg , render ){
     
        var itemDay, newItem, firstItem, itemDayDate, nextColumn, newConfig;
     
        if( render === undefined || render === null ){
          render = false;
        }

        
        // which column are we adding this to?
        itemDay = this._findFirstItemDay( oCfg.DTSTART, oCfg.DTEND );

        
        if( itemDay === false ){
          return false;
        }
        
 
         // useful internal function to save and render a newly added item
         var that = this;
         var saveAndRender = function( item ){

            that._itemHash[ item.get("element").id ] = item;
      
            if( render ){
               that._diaryData[ item.get("column").get("coldate").getTime() ]._rebuildBlocks();
               that._diaryData[ item.get("column").get("coldate").getTime() ]._renderBlocks();
            }
            
            that._applyFiltersToElement( item.get("element") );
            
         };
 
 
        
        // Create a date object for the column date
        itemDayDate = new Date( itemDay );
        
        
        // Alter the config passed to DiaryItem:
        newConfig = Lang.merge( oCfg, { 
                resizeTop: true, 
                resizeBottom: true ,
                enableDragDrop: true,
                useAnimation: this.get("useAnimation")
        });
        
        
        
        // if it's a one-day item, just add it:
        
        if( this._sameDay( oCfg.DTSTART , oCfg.DTEND ) ){
        
           firstItem = this._diaryData[ itemDay ].addItem( newConfig );
           saveAndRender( firstItem );
          
        }
        
        
        // otherwise it extends over several days:
        
        else {
        

              nextColumn = this._diaryData[ itemDay ];

              // loop through until we reach the end of the Diary view, or the end of the event
              while( nextColumn !== undefined && !DM.after( nextColumn.get("coldate") , oCfg.DTEND ) ){


                  // Alter the config passed to DiaryItem:                                                            
                  newConfig = Lang.merge( oCfg, { resizeTop: true, resizeBottom: true ,enableDragDrop: true } );  
                  
                  
                                 
                 // Is the real start date of the item the same as the column
                 // we're adding it to?
                 
                 if( this._sameDay( oCfg.DTSTART , nextColumn.get("coldate") ) ){
                 
                   // this is the first of a multi-day event: 
                   //   displayed start time == DTSTART
                   //   top handle for resize
                   //   no drag-drop
                   //   no bottom handle for resize
                   newConfig = Lang.merge( newConfig, { 
                           resizeBottom: false ,
                           enableDragDrop: false ,
                           _displayDTSTART: oCfg.DTSTART,
                           _displayDTEND: this._getEndOfDay( nextColumn.get("coldate") ),
                           multiDayPosition: "first"
                      } 
                   );

            
                 } else {
                 
                   // is this the last day of the item?
                   if( this._sameDay( oCfg.DTEND , nextColumn.get("coldate") ) ){
                   
                       //   displayed end time == DTEND
                       //   display start tiem = midnight
                       //   no top handle for resize
                       //   no drag-drop
                       //   bottom handle for resize
                       newConfig = Lang.merge( newConfig, { 
                               resizeTop: false ,
                               enableDragDrop: false ,
                               _displayDTSTART: nextColumn.get("coldate"),
                               _displayDTEND: oCfg.DTEND ,
                               multiDayPosition: "last"
                          } 
                       );

                       
                   } else {
                   
                     // this is an intermediate item 
                     // no dragdrop
                     // no resize
                     // runs from midnight to midnight
                     newConfig = Lang.merge( newConfig,  { 
                           resizeBottom: false ,
                           resizeTop: false,
                           enableDragDrop: false ,
                           _displayDTSTART:  nextColumn.get("coldate"),
                           _displayDTEND: this._getEndOfDay( nextColumn.get("coldate") ),
                           multiDayPosition: "mid"
                       } 
                     );

                   }
                   
                 
                 } // end of setting up the config objects


                 // create and add the new Item:
                 newItem = nextColumn.addItem( newConfig );
           
                 if( firstItem === undefined || firstItem === null ){
                 
                   firstItem = newItem;
                 
                 } else {
                 
                   // add parent/child references:
                   firstItem.addMultiDayChild( newItem );
                   newItem.set( "multiDayParent" , firstItem );
                   
                 }
                 
                 saveAndRender( newItem );
              
                 // go on to the next column:
                 nextColumn = nextColumn.next();
           
              
              }// end of while loop
           

        
        
        } // end of adding multi-day events
               
        


        
        return firstItem;
     },


     
     
     /**
      * @method getItem
      * @description Returns the DiaryItem with id elId
      * @param {String}
      * @return {DiaryItem}
      *
      */
     getItem: function( elId ){
       var el = this._itemHash[ elId ];
       if( el ){
         return el;
       }
       return false;
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
       */
     handleItemClick: function( ev , el, container ){
         YAHOO.log( 'Diary.handleItemClick', "info");
         
         /**
          * @event itemClick
          * @param oArgs.item  The DiaryItem clicked on
          * @param oArgs.ev    The click event
          * @param oArgs.el    The element clicked on
          * @param oArgs.container  The container element (from delegate)
          */
         this.fireEvent( "itemClick" , 
                         { item: this.getItem( el.id ),
                           ev:   ev,
                           el:   el,
                           container: container } );
                     
     },

     
     /**
      * @method handleItemMouseEnter
      * @description When a DiaryItem is mouseenter-ed
      */
     handleItemMouseEnter: function( ev, el, container ){

         /**
          * @event itemClick
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
      _doPrevious: function() {

          var newStartDate = DM.subtract( this.get("startDate"), DM.WEEK , 1 );
          this.set( "startDate" ,newStartDate );

          this._reDo();
      },

     /**
      * @method _doNext
      * @description Go to the next day/week
      * @protected
      */      
      _doNext: function() {

          var newStartDate = DM.add( this.get("startDate"), DM.WEEK , 1 );
          this.set( "startDate" ,newStartDate );
          
          this._reDo();
      },
      
     /**
      * @method _doCalNav
      * @description Go to any start date (set by calendar)
      * @param Event
      * @param Array Selected date, as returned by YAHOO.util.Calendar (ie array [[[ yyyy, mm, dd]]])
      * @protected
      */      
      _doCalNav: function(ev , selDate ) {
         this._navCalendar.hide();
         this.set( "startDate" ,new Date( selDate[0][0][0], selDate[0][0][1] - 1 , selDate[0][0][2] ) );
         this._reDo();
      },
      
      /**
       * @method _doFirstDayOfTodaysWeek
       * @description Goes to the start of this week
       * @protected
       */
      _doFirstDayOfTodaysWeek: function() {

         YAHOO.log( "Diary._doFirstDayOfWeek "  , "info" );
         
         var startOfWeek =  DM.getFirstDayOfWeek( new Date(), 1 ),
             currentStart = this.get( "startDate" );

         // do we need to change?
         if( DM.after( startOfWeek , currentStart ) && DM.before( startOfWeek,currentStart ) ){
           return;
         }
         this.set( "startDate", startOfWeek);
         this._reDo();
      },
      
      /**
       * @method _reDo
       * @description Redraws calendar, deleting DiaryItems and data currently held first
       * @protected
       */
      _reDo: function(){
          
          this._destroyDays();
          this._destroyData();
          
          this.setupDays();
          
          this.initData( this.get("element"), {}, this._ds );
          
          this._renderTitle();
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
	     * @param YAHOO.util.DataSource
	     * @protected
	     */
	    _getData: function( oDS ){
         
         oDS.sendRequest( oDS , { success: this._parseData,            
											            failure: this._dataFailed,
											            scope: this 
         });

	    },
	    
	    
	    /**
	     * Parses the data when it comes
	     * @param {Object}		Request object
	     * @param {Object}		Data returned by DataSource
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
                 
                 newData = Lang.merge( currentData, {  
                     DTSTART: currentData[fieldMap.DTSTART],
                     DTEND:   currentData[fieldMap.DTEND],
                     SUMMARY: currentData[ fieldMap.SUMMARY ],
                     DESCRIPTION: currentData[ fieldMap.DESCRIPTION ],
                     URL : currentData[ fieldMap.URL ],
                     backClass: currentData[ fieldMap.backClass ],
                     detailClass: currentData[ fieldMap.detailClass ]                   
                 } );
                 this.addItem( newData );

               }
           }
          
          }
           
         }
      
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
               target: parent 
        });

        YAHOO.log("end of parse" , "info");    
	    },
	    
	    
	    /**
	     * @description Looks for the first day between startDate and endDate that has a column
	     * in the diary; multi-day items may not start in range but may go into it.
	     * @param {Date}
	     * @param {Date}
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
	     * @param {Date}
	     * @return {Date}
	     * @private
	     */
	    _getDay: function ( date ){
	    
	      return new Date( date.getFullYear(), date.getMonth(), date.getDate() , 0 ,0,0,0);
	    
	    },
	    
	    
	    /**
	     * @method _getEndOfDay
	     * @description Returns a Date object with times set to 23:59:59
	     * @param {Date}
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
	     * @param Date
	     * @param Date
	     * @return Boolean
	     * @private
	     */
	    _sameDay: function ( date1, date2 ){
	      return ( date1.getFullYear() == date2.getFullYear() && date1.getMonth() == date2.getMonth() && date1.getDate() == date2.getDate() );
	    
	    },
	    
	    /**
	     * @method _dataFailed
	     * @description Called if sendRequest fails on the data
	     * @method _dataFailed
	     * @param {object}   Request object that failed
	     * @private
	     */
	    _dataFailed: function( req ){

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
	     * @param DiaryItem
	     * @param DiaryItem
	     * @return boolean        True if oItem2 is before oItem1
	     * @private
	     */
	    _itemSorter: function( oItem1 , oItem2 ){ 
	      return DM.before( oItem2.get( "DTSTART" ) , oItem1.get( "DTSTART" ) );
	    },
	    
	    /**
	     * @method _itemSorter
	     * @description Sorting function for arranging items in ascending date/time order, using raw data objects
	     * @param Object    Property DTSTART used for sorting
	     * @param Object
	     * @return boolean        True if oItem2 is before oItem1
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
       * @description Renders the Diary
       * 
       */
      render: function(){

         this.addClass( "lplt-diary-container" );
         
         this._renderDays();
         
         this._renderNav();
         
         this._renderTooltip();
         
         /**
          * @event render
          * @description When the rendering of the Diary is complete
          * @param oArgs.target  Diary
          */ 
         this.fireEvent( "render" , { target: this });

      },
      
      

      /**
       * @method _renderNav
       * @description Renders the navigation. 
       * Provides left, today, calendar and right buttons, and adds listeners.
       * @protected
       * 
       */      
      _renderNav: function(){
      
        if( this.getNavContainer() !== false ){
          return;
        }
      
        var navContainer = document.createElement("div"),
            titleContainer = document.createElement("div"),
            calContainer, cal, calId, calShowButton,
            left = document.createElement( "a" ),
            right = document.createElement( "a" ),
            today = document.createElement( "a" ),
            dayLabels = document.createElement("div"),
            labelEl = document.createElement("span"),
            thisLabel,
            dayCounter = 0;

        
        
  
        Dom.insertBefore( labelEl, parent.firstChild );
            
        Dom.addClass( navContainer , "lplt-diary-nav" );
        Dom.addClass( titleContainer , "lplt-diary-title" );
        Dom.addClass( left , "lplt-diary-nav-left" );
        Dom.addClass( right , "lplt-diary-nav-right" );
        Dom.addClass( today , "lplt-diary-nav-today" );
        
        left.innerHTML = "previous";
        right.innerHTML = "next";
        today.innerHTML = "today";
        
        
        navContainer.appendChild( titleContainer );
        
        navContainer.appendChild( left );
        
        if( YAHOO.widget.Calendar !== undefined && this.get("calenderNav") ){
          calContainer = document.createElement("div");
          calShowButton = document.createElement("div");
          
          calId = Dom.generateId();
          Dom.addClass( calContainer, "lplt-diary-nav-cal" );
          Dom.addClass( calShowButton, "lplt-diary-nav-calbutton" );
          calShowButton.appendChild( document.createTextNode( "show calendar" ) );
          Ev.on( calShowButton , "click" , this.showNavCalendar, this, true );
          
          calContainer.id = calId;
          navContainer.appendChild( calShowButton );
          navContainer.appendChild( calContainer );

        }
        
        navContainer.appendChild( today );
        navContainer.appendChild( right );
        
        
        
        this.get("element").insertBefore( navContainer, this.get("element").firstChild );
      
      
        if( calId !== null ){
                    
          cal = new YAHOO.widget.Calendar( "navcal" , calId, { close: true, navigator: true } );
          
          cal.selectEvent.subscribe( this._doCalNav, this, true );
          cal.hide();
          cal.render();

          this._navCalendar = cal;
        }
        
                    
            
        // label for the date
        Dom.addClass(dayLabels, "lplt-diary-collabel-container");
        Dom.addClass( labelEl, "lplt-diary-collabel" );
        Dom.setStyle( labelEl, "width" , (this._colWidth ) + "px");
        // go through the days adding labels:
        for (dayCounter = 0; dayCounter < 7; dayCounter += 1 ) {
        
          thisLabel = labelEl.cloneNode(false);
          thisLabel.appendChild( 
              document.createTextNode( 
                  this.renderDateLabel( 
                      new Date(this._colToDayMap[ dayCounter ]))));
          dayLabels.appendChild(thisLabel);
        }
        navContainer.appendChild(dayLabels);
        
      
        Ev.on( left, "click" , this._doPrevious , this , true );
        Ev.on( right , "click" , this._doNext , this , true );
        Ev.on( today, "click" , this._doFirstDayOfTodaysWeek, this, true );
        
        this._renderTitle();
      
      },
      
      
      /**
       * @method getNavContainer
       * @description Returns the container for the navigation els
       * @return {HTMLElement}
       */
      
      getNavContainer: function(){
        var con = Dom.getElementsByClassName( "lplt-diary-nav", "div", this.get("element" ) );
        
        if( con === null || con === undefined || con.length === 0 ){
          return false;
        }
        return con[0];
      },
      
      
      /**
       * @method showNavCalendar
       * @description Shows the calendar navigator
       */
      showNavCalendar: function(ev){
        var cal = this._navCalendar;
        
        cal.show();
        Dom.setXY( cal.oDomContainer, [ ev.clientX - 200, ev.clientY ] );
      },
      
      /**
       * @method _renderDays
       * @description Loops through starting at startdate to render days
       * @private
       */
      _renderDays: function() {
      
        var i, dayHeight, scrollTop;
      

        for( i = this.get("startDate").getTime() ; i < this.get("startDate").getTime() + 604800000 ; i += 86400000 ) {
        
          if( this._diaryData[ i ] !== undefined ) {
          
             this._diaryData[ i ].render();
          
          }
        
        }
        
        // set the style of the containers to get the height:
        dayHeight = ( this.get("display").endTime - this.get("display").startTime ) * PX_PER_HOUR; 
        Dom.getElementsByClassName( "lplt-diaryday-container" , "div", this._calHolder, 
                                    function(n){Dom.setStyle( n, "height" , dayHeight + "px" ); } );


        scrollTop = this.get("display").startTime * PX_PER_HOUR;
        this._calHolder.scrollTop = scrollTop; 

        //move the labels
        /*Dom.getElementsByClassName( "lplt-diary-collabel" , "span", this.get("element"), 
                                    function(n){Dom.setStyle( n, "top" , scrollTop + "px" ); } );
          */                          
      },
      
      /**
       * @method renderDateLabel
       * @description  Overwritable to render date labels
       * @param {Date}
       * @return {String}
       */
      renderDateLabel: function( oDate ) {
        return oDate.toString().substring( 0, 10 );
      },
      
      
      /**
       * @method renderDateLabel
       * @description  Puts the title text in the title container box
       * Doesn't actually produce the title string though.
       * @protected
       */
      _renderTitle: function(){
         var titleBox = Dom.getElementsByClassName( "lplt-diary-title", "div", this.getNavContainer() );
         titleBox[0].innerHTML = this.renderTitle();
      },
      
      
      /**
       * @method renderDateLabel
       * @description  Overwriteable to render title string
       * Can use strftime identifiers in the format string
       * @param {String}
       * @return {String}
       */
      renderTitle: function( titleString ){
      
         if( titleString === undefined ) {
           titleString = this.get( "titleString" );
         }
         
         return YAHOO.util.Date.format( this.get("startDate"), { format: titleString } , this.get("locale") );
      
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
       * @method addItemFilter
       * @description Filters DiaryItems based on css selector.
       * selector passed will be appended directly to ".lplt-diary-item"
       * If nothing is passed, it will filter for all (ie hide everything)
       * @param {String}
       * @param {Int} Number of items hidden
       */
      addItemFilter: function( selector ){
      
        YAHOO.log( "Diary.addItemFilter" , "info" );        
       
        var i, 
        items = YAHOO.util.Selector.query( ".lplt-diary-item" + selector, this.get("element") );

        for( i = 0; i < items.length; i++ ){
          Dom.addClass( items[i] , "lplt-diary-item-hidden" );
        }
        this._filters[ selector ] = true;
        
        return i;
      
      },
      /**
       * @method removeItemFilter
       * @description Removes filter on DiaryItems based on css selector.
       * selector passed will be appended directly to ".lplt-diary-item"
       * If nothing is passed, it will filter for all (ie show everything)
       * @param {String}
       * @return {Int} Number of items shown
       */      
      removeItemFilter: function( selector ){
        var i, 
        items = YAHOO.util.Selector.query( ".lplt-diary-item" + selector, this.get("element") );
        
        for( i = 0; i < items.length; i++ ){
          Dom.removeClass( items[i] , "lplt-diary-item-hidden" );
        }
        // remove this filter from memory.
        this._filters[ selector ] = undefined;
        
        return i;      
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
      _applyFiltersToElement: function( el ){
        var i,filters = this._filters;
        
        for( i in filters ){
          if( Lang.isString( i ) && filters[ i ] === true && YAHOO.util.Selector.test( el , i )) {
            Dom.addClass( el , "lplt-diary-item-hidden" );
          }
        }      
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
        
        for( i = 0; i < this._itemHash.length; i++ ){
          this._itemHash[ i ].destroy();
        }
        
        this._itemHash = [];
        this._diaryData = [];
        this._colToDayMap = [];
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
      
      
})();
YAHOO.namespace( "widget" );
YAHOO.register("diary", YAHOO.widget.Diary, {version: "1.0", build: "003"});