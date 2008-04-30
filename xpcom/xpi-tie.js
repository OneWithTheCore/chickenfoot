/**
 * This method assembles all of the required files to write the xpi file into a temporary directory,
 * then writes the contents of this temporary directory to an xpi file. The temporary directory is
 * a folder called 'cftExtPkgr_TEMP_DIR' in the same directory that the xpi file will be written to.
 * This temporary directory is deleted upon completion of the packaging. The xpi file and the
 * chickenfoot-xpi-tie.jar inside of it are zipped differently for Firefox 2 and 3. 
 *    Firefox 2: invokes the Java method 'ExportXpi.writeToZip'
 *    Firefox 3: uses the nsIZipWriter XPCOM component
 *
 * @param outputPath : String //full absolute path of where the xpi file will be written to
 * @param templateTags : Object //map of strings that be used to fill in template files
 * @param triggers : Array<Trigger> //array of the Trigger objects to be included in the xpi file
 * @param userFiles : Array<String> //array of other filepaths (not triggers) to be included in the xpi file
 * @param iconPath : String //full absolute path of the icon for the extension, or null to use the default icon
 * @param chromeWindow : ChromeWindow //reference to chromeWindow of browser
 * @return nsIFile object of generated xpi file
 */
function xpiTie(/*String*/outputPath, /*Object*/templateTags, /*Array*/triggers, /*Array*/userFiles, /*String*/iconPath, /*ChromeWindow*/chromeWindow) {
  //convenient reference to Chickenfoot.SimpleIO
  var io = SimpleIO;

  //get reference to nsILocalFile object for xpi file
  var xpiFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  xpiFile.initWithPath(outputPath);
  
  //create a temporary directory for building the jar and xpi files
  var tempDirPath = xpiFile.parent.path.replace(/\\/g, "\\") + "\\cftExtPkgr_TEMP_DIR";
  io.makeDir(tempDirPath);
  var tempDir = io.toFile(tempDirPath);
  //debug("tempDirPath = " + tempDirPath);

  //get extension path
  var mgr = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
  var loc = mgr.getInstallLocation("{@GUID@}");
  var file = loc.getItemLocation("{@GUID@}");
  var extensionPath = file.path;
  
  //assemble contents for and zip chickenfoot-xpi-tie.jar
  writeXpiTieJar();
  
  //assemble contents for and zip xpi file
  writeXpiFile(tempDir);

  return xpiFile;
  
  
  /**
   * This inner function first assembles all the needed files for the chickenfoot-xpi-tie.jar file into a 'content' directory inside
   * the temporary directory. Then it writes the chickenfoot-xpi-tie jar to a 'chrome' directory inside the temporary directory.
   **/
  function writeXpiTieJar() {
    //create chickenfoot-xpi-tie.jar
    io.makeDir(tempDirPath + "\\chickenfoot-xpi-tie_TEMP_DIR\\content");
    var contentDir = io.toFile(tempDirPath + "\\chickenfoot-xpi-tie_TEMP_DIR\\content");
    var contentDirPath = contentDir.path.replace(/\\/g, "\\");

    //add chickenscratch.xul, contents.rdf, and overlay.xul to content directory ------
    var contentFiles = ["\\chickenscratch.xul", "\\chickenscratch.js", "\\contents.rdf", "\\overlay.xul"];
    for(var i=0; i<contentFiles.length; i++) {
      var templateTxt = io.read(extensionPath + "\\export" + contentFiles[i]);
      io.write(contentDirPath + contentFiles[i], fillTemplate(templateTxt, templateTags));
    }

    //add icon.png to content directory ------
    if((iconPath != null) && (iconPath != "") && io.exists(io.toFile(iconPath))) { //get user's image if supplied 
      var imgFile = io.toFile(iconPath);
      imgFile.copyTo(contentDir, "icon.png");
    }
    else { //otherwise get the chickenfoot image from chickenfoot.jar
      var zipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);

      //create a blank image file in the content dir to overwrite with 
      var jarFile = io.toFile(extensionPath + "\\chrome\\chickenfoot.jar");
      var iconFile = io.toFile(contentDirPath + "\\icon.png");
      io.writeBytes(iconFile, "", false);

      //this init call is needed in Firefox 2 and lower, but throws an exception in Firefox 3, so just catch it and continue
      try { zipReader.init(jarFile); } catch(e) { }
      zipReader.open(jarFile);
      zipReader.extract("skin/classic/beak-32.png", iconFile);
      zipReader.close();
    }

    //add libraries to content directory ------
    var librariesFile = io.toFile(extensionPath + "\\libraries");
    librariesFile.copyTo(contentDir, "libraries");

    //zip content directory to chrome\\chickenfoot-xpi-tie.jar ------
    io.makeDir(tempDirPath + "\\chrome");
    writeToZip(chromeWindow, tempDirPath + "\\chickenfoot-xpi-tie_TEMP_DIR", tempDirPath + "\\chrome\\chickenfoot-xpi-tie.jar");
    
    //delete content directory from temporary directory ------
    contentDir.parent.remove(true);
  } //end writeXpiTieJar()
  
  
  /**
   * This inner function first assembles all the needed files for the xpi file into the temporary directory. Then it 
   * writes all the files inside the temporary directory to the xpi file, and deletes the temporary directory.
   * Note: each '------' separates the code for assembling the needed files for a different top-level entry in the xpi file
   **/
  function writeXpiFile(/*nsILocalFile*/tempDir) {
    //create components directory ------
    // by copying chickenfoot's components directory EXCEPT FOR ChickenfootCommandLineHandler.js
    var cftComponentsDir = io.toFile(extensionPath + "\\components");
    cftComponentsDir.copyTo(tempDir, "components");

    var commandLineHandlerFile = io.toFile(tempDirPath + "\\components\\ChickenfootCommandLineHandler.js");
    if(io.exists(commandLineHandlerFile)) { commandLineHandlerFile.remove(false); }
    
    //Chickenfoot.js and Chicken-bypass.js are templates and need to be filled in
    var componentsFiles = ["\\Chicken-bypass.js", "\\Chickenfoot.js"];
    for(var i=0; i<componentsFiles.length; i++) {
      var templateTxt = io.read(extensionPath + "\\export" + componentsFiles[i]);
      io.write(tempDirPath + "\\components" + componentsFiles[i], fillTemplate(templateTxt, templateTags));
    }

    //create defaults directory ------
    io.makeDir(tempDirPath + "\\defaults\\preferences");
    var defaultsDir = io.toFile(tempDirPath + "\\defaults\\preferences");

    //add preferences.js file to defaults directory
    var preferencesTxt = io.read(extensionPath + "\\export\\preferences.js");
    var preferencesFile = io.toFile("preferences.js", defaultsDir);
    io.write(preferencesFile, fillTemplate(preferencesTxt, templateTags), false);

    //create java directory -------
    // by copying chickenfoot's java directory
    var cftJavaDir = io.toFile(extensionPath + "\\java");
    cftJavaDir.copyTo(tempDir, "java");

    //write install.rdf file ------
    var installTemplateTxt = io.read(extensionPath + "\\export\\install.template.rdf");
    io.write(tempDirPath + "\\install.rdf", fillTemplate(installTemplateTxt, templateTags));

    //write triggers.xml file ------
    var triggersXmlTxt = createTriggersXML(triggers);
    io.write(tempDirPath + "\\triggers.xml", fillTemplate(triggersXmlTxt, templateTags));

    //write trigger script files ------
    for(var i=0; i<triggers.length; i++) {
      var triggerScriptFile = triggers[i].path;
      triggerScriptFile.copyTo(tempDir, null);
    }
    
    //write user files and folders ------
    for(var i=0; i<userFiles.length; i++) {
      var userFile = io.toFile(userFiles[i].replace(/\\/g, "\\"));
      if(!io.exists(userFile)) { continue; }
      userFile.copyTo(tempDir, null);
    }
    
    //write temporary directory to xpi file, then delete temporary directory ------
    var tempDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    tempDir.initWithPath(tempDirPath);
    writeToZip(chromeWindow, tempDirPath, outputPath);
    tempDir.remove(true);
    
    //write update.rdf file if url supplied ------
    if(templateTags.EXTENSION_URL != "") {
      var updateTemplateTxt = io.read(extensionPath + "\\export\\update.template.rdf");
      io.write(xpiFile.parent.path.replace(/\\/g, "\\") + "\\update.rdf", fillTemplate(updateTemplateTxt, templateTags));
    }
  } //end writeXpiFile()
} //end xpiTie()



/**
 * This method takes a string and replaces all instances of the keys of the map with the value that they
 * are mapped to. Just a replace-all function on the string for the keys of the map with their values.
 *
 * @param txt : String //this is the string that will be modified
 * @param map : Object //this is the map where the keys and their values come from
 * @return the modified string
 **/
function fillTemplate(/*String*/ txt, /*Object*/ map) {
  for(var property in map) { txt = txt.replace(new RegExp("@" + property + "@", "g"), map[property]); }
  return txt;
}



/**
 * This method writes all the files inside the temporary directory to a new zip file located at the output
 * file path. This method behaves differently for Firefox 2 and 3.
 *    Firefox 2: calls down to a method identical to this function in java 'ExportXpi.writeToZip'
 *    Firefox 3: uses nsIZipWriter
 *
 * @param chromeWindow : ChromeWindow //reference to chromeWindow of browser
 * @param tempDirPath : String //full absolute path of the temporary directory
 * @param outputPath : String //full absolute path where the zip file will be written to
 **/
function writeToZip(/*ChromeWindow*/chromeWindow, /*String*/tempDirPath, /*String*/outputPath) {
  //check if is Firefox 3
  var firefox3 = (chromeWindow.navigator.userAgent.match("Firefox/3") != null);

  //if FireFox 3, then use nsIZipWriter
  if(firefox3) {
    //references to tempDir and output zip file
    var tempDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    tempDir.initWithPath(tempDirPath);
    var zipFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    zipFile.initWithPath(outputPath);
		
    //use the same zip writer for writing all entries
    var ZipWriter = Components.Constructor("@mozilla.org/zipwriter;1","nsIZipWriter");
    var zipWriter = new ZipWriter();
    zipWriter.open(zipFile, /*PR_RDWR*/4 | /*PR_CREATE_FILE*/8 | /*PR_TRUNCATE*/32);
    
    //iterate through all files in tempDir and write them to output file
    var tempDirFiles = tempDir.directoryEntries;
    while(tempDirFiles.hasMoreElements()) { writeFileToZip(tempDirFiles.getNext().QueryInterface(Components.interfaces.nsIFile), zipWriter, null); }
    zipWriter.close();
  }
  
  //if not Firefox 3, then call java method 'ExportXpi.writeToZip' (identical to this function, but in java)
  else {
    var exportXpiClass = getJavaClass("chickenfoot.ExportXpi");
    var writeToZipFunc = exportXpiClass.getMethod("writeToZip", [java.lang.String, java.lang.String]);
    writeToZipFunc.invoke(null, [tempDirPath, outputPath]);
  }
}



/**
  * This method writes a single file or directory to a zip file using the given zip writer.
  * For directories, this method recursively calls itself on each of the files in the directory.
  * The file or directory is not modified or deleted, only copied. This method never uses a reference
  * to the actual zip file or its path, it only uses the given zip writer.
  * 
  * @param currentFile : nsIFile //nsIFile object to be written to the zip file
  * @param zipWriter : nsIZipWriter //zip writer used to write to the zip file
  * @param dirName : String //optional prefix to attach to the file name in the zip file, ignored if null
  * 
  * @requires currentFile, zipWriter != null
  **/
function writeFileToZip(/*nsIFile*/currentFile, /*nsIZipWriter*/zipWriter, /*String*/dirName) {
  if (currentFile.isFile()) { //currentFile is a file (i.e. not a directory)
    //file name in zip file
    var fileName = currentFile.leafName;
    if(dirName != null) { fileName = dirName + fileName; }

    //read bytes from file into a buffer, then write to the zip file from this buffer
    try {
      zipWriter.addEntryFile(fileName, Components.interfaces.nsIZipWriter.COMPRESSION_DEFAULT, currentFile, false);
    } catch(e) { chromeWindow.alert('caught exception : nsIZipWriter'); }
  }
  else { //currentFile is a directory
    //directory prefix in zip
    var subDirName = currentFile.leafName + "/";
    if(dirName != null) { subDirName = dirName + subDirName; }

    //iterate through the contents of the directory and recursively call this function on each one
    var listFiles = currentFile.directoryEntries;
    while(listFiles.hasMoreElements()) { writeFileToZip(listFiles.getNext().QueryInterface(Components.interfaces.nsIFile), zipWriter, subDirName); }
  }
}



/**
 * This method creates a triggers.xml file (as a string) given a list of triggers.
 * @param triggers : list of Trigger objects //the triggers to add to the triggers.xml file
 * @return the generated xml document as a string
 */
function createTriggersXML(triggers) {
  var domParser = Components.classes["@mozilla.org/xmlextras/domparser;1"].
                  getService(Components.interfaces.nsIDOMParser);
  var domSerializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].
                        getService(Components.interfaces.nsIDOMSerializer);
  
  var xmlString = '<triggers version="0.5"></triggers>';
  var xmlDoc = domParser.parseFromString(xmlString, "text/xml");
  var docElement = xmlDoc.documentElement;
  
  for(var g=0; g<triggers.length; g++) {
    
    // Fixed bug #382: when triggers are packaged as an extension, all triggers should be enabled in the package
    triggers[g].enabled = true;
    
    gTriggerManager._appendTriggerXmlNode(xmlDoc, docElement, triggers[g]);
  }
  var xmlArray = new Array();
  gTriggerManager._prettyPrint(xmlDoc, "", xmlArray);
  xmlString = "";
  for(var i=0; i<xmlArray.length; i++) {
    xmlString += xmlArray[i];
  }
  //Converting javascript String to java String
  return xmlString;
}