// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Each row in the filtered items list is backed by a SourceEntry. This
 * instance contains all of the data pertaining to that row, and notifies
 * its parent view (the RequestsView) whenever its data changes.
 *
 * @constructor
 */
function SourceEntry(parentView) {
  this.entries_ = [];
  this.parentView_ = parentView;
  this.isSelected_ = false;
  this.isMatchedByFilter_ = false;
}

SourceEntry.prototype.isSelected = function() {
  return this.isSelected_;
};

SourceEntry.prototype.setSelectedStyles = function(isSelected) {
  changeClassName(this.row_, 'selected', isSelected);
  this.getSelectionCheckbox().checked = isSelected;
};

SourceEntry.prototype.setMouseoverStyle = function(isMouseOver) {
  changeClassName(this.row_, 'mouseover', isMouseOver);
};

SourceEntry.prototype.setIsMatchedByFilter = function(isMatchedByFilter) {
  if (this.isMatchedByFilter() == isMatchedByFilter)
    return;  // No change.

  this.isMatchedByFilter_ = isMatchedByFilter;

  this.setFilterStyles(isMatchedByFilter);

  if (isMatchedByFilter) {
    this.parentView_.incrementPostfilterCount(1);
  } else {
    this.parentView_.incrementPostfilterCount(-1);
    // If we are filtering an entry away, make sure it is no longer
    // part of the selection.
    this.setSelected(false);
  }
};

SourceEntry.prototype.isMatchedByFilter = function() {
  return this.isMatchedByFilter_;
};

SourceEntry.prototype.setFilterStyles = function(isMatchedByFilter) {
  // Hide rows which have been filtered away.
  if (isMatchedByFilter) {
    this.row_.style.display = '';
  } else {
    this.row_.style.display = 'none';
  }
};

SourceEntry.prototype.update = function(logEntry) {
  var prevStartEntry = this.getStartEntry_();
  this.entries_.push(logEntry);
  var curStartEntry = this.getStartEntry_();

  // If we just got the first entry for this source.
  if (!prevStartEntry && curStartEntry) {
    this.createRow_();

    // Only apply the filter during the first update.
    // TODO(eroman): once filters use other data, apply it on each update.
    var matchesFilter = this.matchesFilter(this.parentView_.currentFilter_);
    this.setIsMatchedByFilter(matchesFilter);
  }
};

SourceEntry.prototype.onCheckboxToggled_ = function() {
  this.setSelected(this.getSelectionCheckbox().checked);
};

SourceEntry.prototype.matchesFilter = function(filterText) {
  // TODO(eroman): Support more advanced filter syntax.
  if (filterText == '')
    return true;

  var filterText = filterText.toLowerCase();

  return this.getDescription().toLowerCase().indexOf(filterText) != -1 ||
         this.getSourceTypeString().toLowerCase().indexOf(filterText) != -1;
};

SourceEntry.prototype.setSelected = function(isSelected) {
  if (isSelected == this.isSelected())
    return;

  this.isSelected_ = isSelected;

  this.setSelectedStyles(isSelected);
  this.parentView_.modifySelectionArray(this, isSelected);
  this.parentView_.onSelectionChanged();
};

SourceEntry.prototype.onClicked_ = function() {
  this.parentView_.clearSelection();
  this.setSelected(true);
};

SourceEntry.prototype.onMouseover_ = function() {
  this.setMouseoverStyle(true);
};

SourceEntry.prototype.onMouseout_ = function() {
  this.setMouseoverStyle(false);
};

SourceEntry.prototype.createRow_ = function() {
  // Create a row.
  var tr = addNode(this.parentView_.tableBody_, 'tr');
  tr.style.display = 'none';
  this.row_ = tr;

  var selectionCol = addNode(tr, 'td');
  var checkbox = addNode(selectionCol, 'input');
  checkbox.type = 'checkbox';

  var idCell = addNode(tr, 'td');
  var typeCell = addNode(tr, 'td');
  var descriptionCell = addNode(tr, 'td');

  // Connect listeners.
  checkbox.onchange = this.onCheckboxToggled_.bind(this);

  var onclick = this.onClicked_.bind(this);
  idCell.onclick = onclick;
  typeCell.onclick = onclick;
  descriptionCell.onclick = onclick;

  tr.onmouseover = this.onMouseover_.bind(this);
  tr.onmouseout = this.onMouseout_.bind(this);

  // Set the cell values to match this source's data.
  addTextNode(idCell, this.getSourceId());
  var sourceTypeString = this.getSourceTypeString();
  addTextNode(typeCell, sourceTypeString);
  addTextNode(descriptionCell, this.getDescription());

  // Add a CSS classname specific to this source type (so CSS can specify
  // different stylings for different types).
  changeClassName(this.row_, "source_" + sourceTypeString, true);
};

SourceEntry.prototype.getDescription = function() {
  var e = this.getStartEntry_();
  if (!e || e.extra_parameters == undefined)
    return '';
  return JSON.stringify(e.extra_parameters);  // The URL / hostname / whatever.
};

/**
 * Returns the starting entry for this source. Conceptually this is the
 * first entry that was logged to this source. However, we skip over the
 * TYPE_REQUEST_ALIVE entries which wrap TYPE_URL_REQUEST_START /
 * TYPE_SOCKET_STREAM_CONNECT.
 *
 * TODO(eroman): Get rid of TYPE_REQUEST_ALIVE so this isn't necessary.
 */
SourceEntry.prototype.getStartEntry_ = function() {
  if (this.entries_.length < 1)
    return undefined;
  if (this.entries_[0].type != LogEventType.REQUEST_ALIVE)
    return this.entries_[0];
  if (this.entries_.length < 2)
    return undefined;
  return this.entries_[1];
};

SourceEntry.prototype.getLogEntries = function() {
  return this.entries_;
};

SourceEntry.prototype.getSourceTypeString = function() {
  return getKeyWithValue(LogSourceType, this.entries_[0].source.type);
};

SourceEntry.prototype.getSelectionCheckbox = function() {
  return this.row_.childNodes[0].firstChild;
};

SourceEntry.prototype.getSourceId = function() {
  return this.entries_[0].source.id;
};

SourceEntry.prototype.remove = function() {
  this.setSelected(false);
  this.setIsMatchedByFilter(false);
  this.row_.parentNode.removeChild(this.row_);
};

