// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// require: listselectionmodel.js

/**
 * @fileoverview This implements a list control.
 */

cr.define('cr.ui', function() {
  const ListSelectionModel = cr.ui.ListSelectionModel;

  /**
   * Whether a mouse event is inside the element viewport. This will return
   * false if the mouseevent was generated over a border or a scrollbar.
   * @param {!HTMLElement} el The element to test the event with.
   * @param {!Event} e The mouse event.
   * @param {boolean} Whether the mouse event was inside the viewport.
   */
  function inViewport(el, e) {
    var rect = el.getBoundingClientRect();
    var x = e.clientX;
    var y = e.clientY;
    return x >= rect.left + el.clientLeft &&
           x < rect.left + el.clientLeft + el.clientWidth &&
           y >= rect.top + el.clientTop &&
           y < rect.top + el.clientTop + el.clientHeight;
  }

  /**
   * Creates a new list element.
   * @param {Object=} opt_propertyBag Optional properties.
   * @constructor
   * @extends {HTMLUListElement}
   */
  var List = cr.ui.define('list');

  List.prototype = {
    __proto__: HTMLUListElement.prototype,

    /**
     * The selection model to use.
     * @type {cr.ui.ListSelectionModel}
     */
    get selectionModel() {
      return this.selectionModel_;
    },
    set selectionModel(sm) {
      var oldSm = this.selectionModel_;
      if (oldSm == sm)
        return;

      if (!this.boundHandleOnChange_) {
        this.boundHandleOnChange_ = cr.bind(this.handleOnChange_, this);
        this.boundHandleLeadChange_ = cr.bind(this.handleLeadChange_, this);
      }

      if (oldSm) {
        oldSm.removeEventListener('change', this.boundHandleOnChange_);
        oldSm.removeEventListener('leadItemChange', this.boundHandleLeadChange_);
      }

      this.selectionModel_ = sm;

      if (sm) {
        sm.addEventListener('change', this.boundHandleOnChange_);
        sm.addEventListener('leadItemChange', this.boundHandleLeadChange_);
      }
    },

    /**
     * Convenience alias for selectionModel.selectedItem
     * @type {cr.ui.ListItem}
     */
    get selectedItem() {
      return this.selectionModel.selectedItem;
    },
    set selectedItem(selectedItem) {
      this.selectionModel.selectedItem = selectedItem;
    },

    /**
     * Convenience alias for selectionModel.selectedItems
     * @type {!Array<cr.ui.ListItem>}
     */
    get selectedItems() {
      return this.selectionModel.selectedItems;
    },

    /**
     * The HTML elements representing the items. This is just all the element
     * children but subclasses may override this to filter out certain elements.
     * @type {HTMLCollection}
     */
    get items() {
      return this.children;
    },

    batchCount_: 0,

    /**
     * When adding a large collection of items to the list, the code should be
     * wrapped in the startBatchAdd and startBatchEnd to increase performance.
     * This hides the list while it is being built, and prevents it from
     * incurring measurement performance hits in between each item.
     * Be sure that the code will not return without calling finishBatchAdd
     * or the list will not be shown.
     * @private
     */
    startBatchAdd: function() {
      // If we're already in a batch, don't overwrite original display style.
      if (this.batchCount_ == 0) {
        this.originalDisplayStyle_ = this.style.display;
        this.style.display = 'none';
      }
      this.batchCount_++;
    },

    /**
     * See startBatchAdd.
     * @private
     */
    finishBatchAdd: function() {
      this.batchCount_--;
      if (this.batchCount_ == 0) {
        this.style.display = this.originalDisplayStyle_;
        delete this.originalDisplayStyle;
      }
    },

    add: function(listItem) {
      this.appendChild(listItem);

      var uid = cr.getUid(listItem);
      this.uidToListItem_[uid] = listItem;

      this.selectionModel.add(listItem);
    },

    addAt: function(listItem, index) {
      this.insertBefore(listItem, this.items[index]);

      var uid = cr.getUid(listItem);
      this.uidToListItem_[uid] = listItem;

      this.selectionModel.add(listItem);
    },

    remove: function(listItem) {
      this.selectionModel.remove(listItem);

      this.removeChild(listItem);

      var uid = cr.getUid(listItem);
      delete this.uidToListItem_[uid];
    },

    clear: function() {
      this.innerHTML = '';
      this.selectionModel.clear();
    },

    /**
     * Initializes the element.
     */
    decorate: function() {
      this.uidToListItem_ = {};

      this.selectionModel = new ListSelectionModel(this);

      this.addEventListener('mousedown', this.handleMouseDownUp_);
      this.addEventListener('mouseup', this.handleMouseDownUp_);
      this.addEventListener('keydown', this.handleKeyDown);

      // Make list focusable
      if (!this.hasAttribute('tabindex'))
        this.tabIndex = 0;
    },

    /**
     * Callback for mousedown and mouseup events.
     * @param {Event} e The mouse event object.
     * @private
     */
    handleMouseDownUp_: function(e) {
      var target = e.target;

      // If the target was this element we need to make sure that the user did
      // not click on a border or a scrollbar.
      if (target == this && !inViewport(target, e))
        return;

      while (target && target.parentNode != this) {
        target = target.parentNode;
      }

      this.selectionModel.handleMouseDownUp(e, target);
    },

    /**
     * Handle a keydown event.
     * @param {Event} e The keydown event.
     * @return {boolean} Whether the key event was handled.
     */
    handleKeyDown: function(e) {
      return this.selectionModel.handleKeyDown(e);
    },

    /**
     * Callback from the selection model. We dispatch {@code change} events
     * when the selection changes.
     * @param {!cr.Event} e Event with change info.
     * @private
     */
    handleOnChange_: function(ce) {
      ce.changes.forEach(function(change) {
        var listItem = this.uidToListItem_[change.uid];
        listItem.selected = change.selected;
      }, this);

      cr.dispatchSimpleEvent(this, 'change');
    },

    /**
     * Handles a change of the lead item from the selection model.
     * @property {Event} pe The property change event.
     * @private
     */
    handleLeadChange_: function(pe) {
      if (pe.oldValue) {
        pe.oldValue.lead = false;
      }
      if (pe.newValue) {
        pe.newValue.lead = true;
      }
    },

    /**
     * Gets a unique ID for an item. This needs to be unique to the list but
     * does not have to be gloabally unique. This uses {@code cr.getUid} by
     * default. Override to provide a more efficient way to get the unique ID.
     * @param {cr.ui.ListItem} item The item to get the unique ID for.
     * @return
     */
    itemToUid: function(item) {
      return cr.getUid(item);
    },

    /**
     * @return {!ClientRect} The rect to use for the context menu.
     */
    getRectForContextMenu: function() {
      // TODO(arv): Add trait support so we can share more code between trees
      // and lists.
      if (this.selectedItem)
        return this.selectedItem.getBoundingClientRect();
      return this.getBoundingClientRect();
    }
  };

  return {
    List: List
  }
});
