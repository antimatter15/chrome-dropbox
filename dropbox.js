/*
 *  Dropbox Javascript library v1.0                                           *
 *  Copyright Peter Josling 2010                                              *
 *	                                                                          *
 *	                                                                          *
 *  Uses the Javascript OAuth library by John Kristian                        *
 *  http://oauth.googlecode.com/svn/code/javascript/                          *
 *	                                                                          *
 *  Also uses SHA1.js by Paul Johnston	                                      *
 *  http://pajhome.org.uk/crypt/md5/	                                        *
 *	                                                                          *
 *	                                                                          *
 *  Licensed under the Apache License, Version 2.0 (the "License");           *
 *  you may not use this file except in compliance with the License.          *
 *  You may obtain a copy of the License at                                   *
 *	                                                                          *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *	                                                                          *
 *  Unless required by applicable law or agreed to in writing, software       *
 *  distributed under the License is distributed on an "AS IS" BASIS,         *
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  *
 *  See the License for the specific language governing permissions and       *
 *  limitations under the License.                                            */


/*
 * Changes: 
 * Got rid of cookie storage, html5 only.
 * No jQuery dependencies (use es5 JSON.parse);
*/


var dropbox = {};
	
//Change to your own Dropbox API keys
dropbox.consumerKey = "hg5wqrwh7mumyu6";
dropbox.consumerSecret = "9c3al0urrvz7ysl";

//Prefix for data storate - MUST be unique
dropbox.prefix = "app_";

//Set to "dropbox" if your application has been given full Dropbox folder access
dropbox.accessType = "dropbox";

//Set to false to disable file metadata caching
dropbox.cache = false;

//Set this to your authorization callback URL
dropbox.authCallback = 'http://example.com/'//chrome.extension.getURL('dropbox.html');

//Maximum number of files to list from a directory. Default 10k
dropbox.fileLimit = 10000;

//Cookie expire time (in days). Default 10 years
dropbox.cookieTime = 3650;


//If using HTML5 local storage

//Get tokens (only declares variables if the token exists)
temp = localStorage.getItem(dropbox.prefix + "requestToken")
if (temp) {
	dropbox.requestToken = temp;
}

temp = localStorage.getItem(dropbox.prefix + "requestTokenSecret")
if (temp) {
	dropbox.requestTokenSecret = temp;
}

temp = localStorage.getItem(dropbox.prefix + "accessToken")
if (temp) {
	dropbox.accessToken = temp;
}

temp = localStorage.getItem(dropbox.prefix + "accessTokenSecret")
if (temp) {
	dropbox.accessTokenSecret = temp;
}


//Setup function runs after libraries are loaded
dropbox.setup = function() {
	//Check if access already allowed
	if (!dropbox.accessToken || !dropbox.accessTokenSecret) {
		//Check if already authorized, but not given access yet
		if (!dropbox.requestToken || !dropbox.requestTokenSecret) {
		  console.log('pathone')
			//Request request token
			dropbox.oauthRequest({
				url: "http://api.dropbox.com/0/oauth/request_token",
				type: "text",
				token: true,
				tokenSecret: true
			}, [], function(data) {
				data = data.split("&");
				dataArray = new Array();
				
				//Parse token
				for (i in data) {
					dataTemp =  data[i].split("=");
					dataArray[dataTemp[0]] = dataTemp[1];
				}
				
				//Store token
				dropbox.storeData("requestToken",dropbox.requestToken = dataArray['oauth_token']);
				dropbox.storeData("requestTokenSecret",dropbox.requestTokenSecret = dataArray['oauth_token_secret']);
				
				//Redirect to autorisation page
				chrome.tabs.create({
				  url: "http://api.dropbox.com/0/oauth/authorize?oauth_token=" + dataArray["oauth_token"] + "&oauth_callback=" + dropbox.authCallback
				}, function(tab){
				  var poll = function(){
			      chrome.tabs.get(tab.id, function(info){
				      if(info.url.indexOf('uid=') != -1){
					      chrome.tabs.remove(tab.id);
					      dropbox.setup();
				      }else{
					      setTimeout(poll, 100)
				      }
			      })
		      };
		      poll();
				})
			});
		} else {
		  console.log('pathtwo');
			//Request access token
			dropbox.oauthRequest({
				url: "http://api.dropbox.com/0/oauth/access_token",
				type: "text",
				token: dropbox.requestToken,
				tokenSecret: dropbox.requestTokenSecret
			}, [], function(data) {
				data = data.split("&");
				dataArray = new Array();
				
				//Parse token
				for (i in data) {
					dataTemp =  data[i].split("=");
					dataArray[dataTemp[0]] = dataTemp[1];
				}
				
				//Store token
				dropbox.storeData("accessToken",dataArray['oauth_token']);
				dropbox.storeData("accessTokenSecret",dataArray['oauth_token_secret']);
				
				//Update variables with tokens
				dropbox.accessToken = dataArray['oauth_token'];
				dropbox.accessTokenSecret = dataArray['oauth_token_secret'];
			});
		}
	}
};


//Run setup when everything's loaded
window.onload = dropbox.setup;

//Function to send oauth requests
dropbox.oauthRequest = function(param1,param2,callback) {
	//If the token wasn't defined in the function call, then use the access token
	if (!param1.token) {
		param1.token = dropbox.accessToken;
	}
	if (!param1.tokenSecret) {
		param1.tokenSecret = dropbox.accessTokenSecret;
	}
	
	//If type isn't defined, it's JSON
	if (!param1.type) {
		param1.type = "json";
	}
	
	//If method isn't defined, assume it's GET
	if (!param1.method) {
		param1.method = "GET";
	}
	
	//Define the accessor
	accessor = {
		consumerSecret: dropbox.consumerSecret,
	};
	
	//Outline the message
	message = {
		action: param1.url,
	    method: param1.method,
	    parameters: [
	      	["oauth_consumer_key", dropbox.consumerKey],
	      	["oauth_signature_method","HMAC-SHA1"]
	  	]
	};
	
	//Only add tokens to the request if they're wanted (vars not passed as true)
	if (param1.token != true) {
		message.parameters.push(["oauth_token",param1.token]);
	}
	if (param1.tokenSecret != true) {
		accessor.tokenSecret = param1.tokenSecret;
	}
	
	//If given, append request-specific parameters to the OAuth request
	for (i in param2) {
		message.parameters.push(param2[i]);
	}
	
	//Timestamp and sign the OAuth request
	OAuth.setTimestampAndNonce(message);
	OAuth.SignatureMethod.sign(message, accessor);
	
	//Post the OAuth request
	var xhr = new XMLHttpRequest();
	if(message.method.toLowerCase() == 'get'){
	  var params = OAuth.getParameterMap(message.parameters), str = [];
	  for(var i in params)
	    str.push(encodeURIComponent(i) +'=' + encodeURIComponent(params[i]));
	  message.action += '?'+str.join('&');
	}
	xhr.open(message.method, message.action, true);
	xhr.setRequestHeader('content-type','application/json');
	xhr.onload = function(){
	  console.log(xhr.responseText);
	  callback(xhr.responseText);
	}
  if(message.method.toLowerCase() == 'get'){
    xhr.send(null);

	}else{
	  xhr.send(JSON.stringify(OAuth.getParameterMap(message.parameters)))
	}
}



//Function to store data (tokens/cache) using either cookies or HTML5, depending on choice
dropbox.storeData = function(name,data) {
	//Escape data to be saved
	data = escape(data);
	
	//If using HTML5 local storage mode
	localStorage.setItem(dropbox.prefix + name,data);
}

//Function to get data (tokens/cache) using either cookies or HTML5, depending on choice
dropbox.getData = function(name) {
	//If using HTML5 local storage mode
	return unescape(localStorage.getItem(dropbox.prefix + name));
}

/*    PUBLIC FUNCTIONS    */

//Function to get account info of user
dropbox.getAccount = function(callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/account/info"
	}, [], function(data) {
		callback(data);
	});
}

//Function to get file/folder metadata
dropbox.getMetadata = function(path,callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/metadata/" + dropbox.accessType + "/" + path
	}, [["list","false"]], function(data) {
		callback(data);
	});
}

//Function to get a list of the contents of a directory
dropbox.getFolderContents = function(path,callback) {
	//If caching is enabled, get the hash of the requested folder
	if (dropbox.cache == true) {
		//Get cached data
		hash = dropbox.getData("cache." + path);
		
		//If cached data exists
		if (hash != "null") {
			//Parse the cached data and extract the hash
			hash = JSON.parse(hash).hash;
		} else {
			//Set to a blank hash
			hash = "00000000000000000000000000000000";
		}
	} else {
		//Set to a blank hash
		hash = "00000000000000000000000000000000";
	}
	
	//Send the OAuth request
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/metadata/" + dropbox.accessType + "/" + path,
		type: "text"
	}, [
		["list","true"],
		["status_in_response","true"],
		["hash",hash]
	], function(data) {
		//If caching is enabled, check if the folder contents have changed
		if (dropbox.cache == true) {
			if (JSON.parse(data).status == 304) {
				//Contents haven't changed - return cached data instead
				data = dropbox.getData("cache." + path);
			} else {
				//Strip out parent JSON object
				data = data.substr(1);
				while (data.charAt(0) != "{") data = data.substr(1);
				data = data.substr(0,data.length-1);
				while (data.charAt(data.length-1) != "}") data = data.substr(0,data.length-1);
				
				//Contents have changed - cache them for later
				dropbox.storeData("cache." + path,data);
			}
		}
		
		//Parse the data as JSON
		data = JSON.parse(data);
		
		//Run the callback
		callback(data);
	});
}

//Function to get the contents of a file
dropbox.getFile = function(path,callback) {
	dropbox.oauthRequest({
		url: "http://api-content.dropbox.com/0/files/" + dropbox.accessType + "/" + path,
		type: "text"
	}, [], function(data) {
		callback(data);
	});
}

//Function to move a file/folder to a new location
dropbox.movetFile = function(from,to,callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/fileops/move"
	}, [
		["from_path",from],
		["to_path",to],
		["root",dropbox.accessType]
	], function(data) {
		callback(data);
	});
}

//Function to copy a file/folder to a new location
dropbox.copyItem = function(from,to,callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/fileops/copy"
	}, [
		["from_path",from],
		["to_path",to],
		["root",dropbox.accessType]
	], function(data) {
		callback(data);
	});
}

//Function to delete a file/folder
dropbox.deleteItem = function(path,callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/fileops/delete",
		type: "text"
	}, [
		["path",path],
		["root",dropbox.accessType]
	], function(data) {
		callback(data);
	});
}

//Function to delete a file/folder
dropbox.createFolder = function(path,callback) {
	dropbox.oauthRequest({
		url: "http://api.dropbox.com/0/fileops/create_folder"
	}, [
		["path",path],
		["root",dropbox.accessType]
	], function(data) {
		callback(data);
	});
}

//Function to get a thumbnail for an image
dropbox.getThumbnail = function(path,size,callback) {
	//Check 'size' parameter is valid
	if (size != "small" && size != "medium" && size != "large") size = "small";
	
	//Send OAuth request
	dropbox.oauthRequest({
		url: "http://api-content.dropbox.com/0/thumbnails/" + dropbox.accessType + "/" + path,
		type: "text"
	}, [["size",size]], function(data) {
		callback(data);
	});
}


//Function to upload a file


dropbox.uploadFile = function(path, file, callback) {

  var param1 = {
		url: "http://api-content.dropbox.com/0/files/" + dropbox.accessType + "/" + path,
		type: "text",
		method: "POST"
	}

	//If the token wasn't defined in the function call, then use the access token
	param1.token = dropbox.accessToken;
	param1.tokenSecret = dropbox.accessTokenSecret;
	param1.type = "text";
	//Define the accessor
	accessor = {
		consumerSecret: dropbox.consumerSecret,
	};
	
	//Outline the message
	message = {
		action: param1.url,
	    method: param1.method,
	    parameters: [
	      	["oauth_consumer_key", dropbox.consumerKey],
	      	["oauth_signature_method","HMAC-SHA1"]
	  	]
	};
	
	//Only add tokens to the request if they're wanted (vars not passed as true)
	if (param1.token != true) {
		message.parameters.push(["oauth_token",param1.token]);
	}
	if (param1.tokenSecret != true) {
		accessor.tokenSecret = param1.tokenSecret;
	}

	//Timestamp and sign the OAuth request
	OAuth.setTimestampAndNonce(message);
	OAuth.SignatureMethod.sign(message, accessor);
	
	//Post the OAuth request
	var xhr = new XMLHttpRequest();

/*
  var params = OAuth.getParameterMap(message.parameters), str = [];
  for(var i in params)
    str.push(encodeURIComponent(i) +'=' + encodeURIComponent(params[i]));
  message.action += '?'+str.join('&');
*/	

	xhr.open(message.method, message.action, true);
	//http://demos.hacks.mozilla.org/openweb/imageUploader/js/extends/xhr.js
	
	xhr.setRequestHeader('Authorization', OAuth.getAuthorizationHeader('http://api-content.dropbox.com/',message.parameters));


  var BOUNDARY = "---------------------------1966284435497298061834782736";
  var rn = "\r\n";
  var req = "--" + BOUNDARY;
  
  req += rn + "Content-Disposition: form-data; name=\"file\"";

  var bin = 'blah blah this is stuff meow i am a kitteh';
  
  req += "; filename=\"" + file + "\"" + rn + "Content-type: application/octet-stream";
  req += rn + rn + bin + rn + "--" + BOUNDARY;
  
  /*
  for (var i in params) {
    req += rn + "Content-Disposition: form-data; name=\"" + i + "\"";
    req += rn + rn + params[i] + rn + "--" + BOUNDARY;
  }*/
  req += "--";

  xhr.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + BOUNDARY);
  xhr.send(req);
	
	xhr.onload = function(){
	  console.log(xhr.responseText);
	  callback(xhr.responseText);
	}
	
	
}

//dropbox.getThumbnail('dropbox/Photos/rgbSampleAll.png','small',function(){console.log(arguments)})
