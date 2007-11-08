/**
 * Enumerate the properties of an object into string form.
 * @param obj Object to enumerate
 * @param opt_regexp optional regular expression.  If provided,
 *                   only property names matching the expression
 *                   are displayed.
 * @param opt_expandibleList optional string. If "expandibleList", the buffer returned
                     contains a set of arrays, each with two elements:
                     the object being listed, and one of its properties.
                     If "count", returns number of properties object has.
                     Used by addDebugOutput for expandable object browser
                     in output pane.
 * @return string containing one line for each property,
 *  roughly of the form "name = value".
 * @return (only if opt_expandibleList == true) returns a buffer containing
                     a set of two-element arrays.
 */
function listImpl(obj, opt_regexp, opt_expandibleList) {
  if (!obj && ((typeof obj != 'object') || obj === null)) {
    // this is a cast, not a constructor
    return String(obj);
  }
  var props = [];
  if (instanceOf(obj, Array)) {
    var len = obj.length;
    for (var i = 0; i < len; ++i) props.push(i);
  } else {
    try {var len = 0;
         for (var property in obj) {
           props.push(property);
           ++len;
           if (len > 1000) break;
         }
         if (props.length == 0) {
           if (obj.wrappedJSObject) {
             props.length == 0;
             if (opt_expandibleList && (opt_expandibleList == "count")) {return 1;}
           }
           else {return obj.toString();}
         }
         if (opt_expandibleList && (opt_expandibleList == "count")) {return len;}
         props.sort(String.localeCompare);
    }
    catch (err) {};
  }
  var buffer = [];
  var value, line;
  for (var i = 0; i < props.length; ++i) {
    var property = props[i];
    if (opt_regexp && property.match && !property.match(opt_regexp)) continue;
    try {      
      value = obj[property];
    } catch (e) {
      value = "***ERROR WHEN READING PROPERTY***";
    }
    if (opt_expandibleList && (opt_expandibleList == "expandibleList")) {buffer.push([obj, property, value]);}
    else {
      line = property + ' = ' + value;
      line = line.replace(/\n/g, "");
      buffer.push(line + '\n');
      }
  }
  //include wrappedJSObject property
  if (opt_expandibleList && (opt_expandibleList == "expandibleList") && obj.wrappedJSObject) {
    buffer.push([obj, "wrappedJSObject", obj.wrappedJSObject])}
  
  if (opt_expandibleList && (opt_expandibleList == "expandibleList") && (instanceOf(obj, Match))) {
    buffer.push([obj, "count", obj._count]);
    buffer.push([obj, "document", obj._document]);
    buffer.push([obj, "element", obj._element]);
    buffer.push([obj, "hasMatch", obj._hasMatch]);
    buffer.push([obj, "html", obj._html]);
    buffer.push([obj, "index", obj._index]);
    buffer.push([obj, "next", obj._next]);
    buffer.push([obj, "node", obj._node]);
    buffer.push([obj, "range", obj._range]);
    buffer.push([obj, "text", obj._text]);
  }

  if (opt_expandibleList && (opt_expandibleList == "expandibleList")) {return groupPropertiesAndMethods(buffer);}
  else {
  return buffer.join("");
  }
}

function groupPropertiesAndMethods (/*array*/items) {
  properties = new Array();
  methods = new Array();
  objects = new Array();
  for (var i=0; i<items.length; i++) {
    current = items[i];
    value = current[2];
      if (typeof value == "function") {methods.push(current);}
      else if (typeof value == "object") {objects.push(current);}
      else {properties.push(current);}
  }
  var joined = properties.concat(methods).concat(objects);
  return joined;
}

