// handle some direct access to preference

function PCManOptions() {
    this.setupDefault = PrefDefaults;
    this.useLoginMgr = PrefLoginMgr;
    this.isFX3 = this.getVersion();
    var _this = this;
    this.promise = new Promise(function(resolve, reject) {
        _this.load().then(function onFulfill() {
            resolve();
        });
    });
}

PCManOptions.prototype = {
    // Find the version of PCManFx
    getVersion: function() {
        var app = Components.classes["@mozilla.org/fuel/application;1"]
                            .getService(Components.interfaces.fuelIApplication);

        if(document.getElementById('pcmanOption'))
            getVersion(app);

        return Boolean(app.extensions);
    },

    load: function() {
        this.groups = [];
        var _this = this;
        var promise = new Promise(function(resolve, reject) {
            _this.prefService(false).then(function onFulfill() {  // read preferences
                // repair the default group
                if(!_this.groups[0]) {
                    _this.copyGroup(0, null, '_override_');
                } else if(_this.groups[0].Name != _this.setupDefault.Name) {
                    _this.groups.unshift({});
                    _this.copyGroup(0, null, '_override_');
                }
                for(var i=_this.groups.length-1; i>=0; --i) {
                    // remove the empty group
                    if(!_this.groups[i]) {
                        _this.removeGroup(i);
                        continue;
                    }
                    // repair the references
                    for(var key in _this.setupDefault) {
                        if(typeof(_this.groups[i][key]) == "undefined")
                            _this.setVal(i, key, _this.setupDefault[key]);
                    }
                }
                _this.setLoginInfo(true);
                resolve();
            });
        });
        return promise;
    },

    save: function() {
        this.setLoginInfo(false);
        var _this = this;
        this.prefService(true).then(function onFulfill() { // write preferences
            _this.setLoginInfo(true);
        });
    },

    getGroupNames: function() {
        var groups = [];
        for(var i=0; i<this.groups.length; ++i)
            groups[i] = this.getVal(i, 'Name', this.setupDefault.Name);
        return groups;
    },

    // Determine the group index by the url
    findGroup: function(url) {
        if(!url) return 0;
        url = url.replace(/.*:\/\/([^\/]*).*/, '$1'); // Trim the protocol
        // search from the newest group
        for(var i=this.groups.length-1; i>=0; --i) {
            if(url == this.getVal(i, 'Name', null))
                return i;
        }
        return 0; // Not found
    },

    getVal: function(group, key, value) {
        if(this.groups[group] && typeof(this.groups[group][key])!='undefined') {
            if(typeof(this.setupDefault[key]) == 'number')
                return parseInt(this.groups[group][key]);
            else
                return this.groups[group][key];
        } else {
            return value;
        }
    },

    setVal: function(group, key, value) {
        if(!this.groups[group])
            this.groups[group] = {};
        this.groups[group][key] = value;
    },

    // Copy fromGroup to toGroup
    // Copy from setupDefault if fromGroup is null.
    // Add a new group if toGroup is null.
    // The name of the copied group can be set simultaneously
    // If the name is set as '_override_', use the name of fromGroup
    copyGroup: function(toGroup, fromGroup, name) {
        name = name.replace(/.*:\/\/([^\/]*).*/, '$1'); // Trim the protocol
        if(toGroup == null)
            toGroup = this.groups.length;
        if(fromGroup == null)
            var data = this.setupDefault;
        else
            var data = this.groups[fromGroup];
        for(var key in data) {
            if(key != 'Name' || name == '_override_')
                this.setVal(toGroup, key, data[key]);
            else if(name)
                this.setVal(toGroup, key, name); // key == 'Name'
        }
    },

    // Remove the group
    // For the default group, reset to the setupDefault 
    removeGroup: function(group) {
        if(group == 0)
            return this.copyGroup(0, null, '_override_');
        this.groups.splice(group,1);
    },

    // Read or write the content preferences

    prefService: function(isWrite) {
        var _this = this;
        var promise = new Promise(function(resolve, reject) {
            var prefService2 = Components.classes["@mozilla.org/content-pref/service;1"]
                               .getService(Components.interfaces.nsIContentPrefService2);
            var getURI = function(group) { // Only used in this function
                if(group == _this.setupDefault.Name)
                    return null;
                try {
                    var uri = Components.classes['@mozilla.org/network/io-service;1']
                              .getService(Components.interfaces.nsIIOService)
                              .newURI('telnet://'+group, null, null);
                    return _this.isFX3 ? uri : uri.hostPort;
                } catch (e) { // incorrect group
                    return null;
                }
            };
            var groupURIs = [null];
            prefService2.getByName('Name', null, {
                handleResult: function(pref) {
                    var groupName = pref.domain;
                    var uri = getURI(groupName);
                    if(groupName && uri)
                        groupURIs.push(uri);
                },
                handleCompletion: function() {
                    if(!isWrite) { // read
                        for(var i=0; i < groupURIs.length; ++i) {
                            if (groupURIs[i]) {
                                for(var key in _this.setupDefault) {
                                    var pref = prefService2.getCachedByDomainAndName(groupURIs[i], key, null);
                                    if (pref) {
                                        _this.setVal(i, key, pref.value);
                                    }
                                }
                            }
                        }
                    } else {  // write
                        for(var i=0; i < _this.groups.length; ++i) {
                            if(groupURIs.join(', ').indexOf(_this.groups[i].Name) < 0)
                                groupURIs.push(getURI(_this.groups[i].Name)); // new groups
                        }
                        for(var i=0; i < groupURIs.length; ++i) {
                            if (groupURIs[i]) {
                                for(var key in _this.setupDefault) {
                                    var groupName = groupURIs[i];
                                    if(_this.isFX3 && groupName)
                                        groupName = groupName.hostPort;
                                    var newVal = null;
                                    if(!groupName || _this.findGroup(groupName)>0)
                                        newVal = _this.getVal(_this.findGroup(groupName), key);
                                    var orgVal = prefService2.getCachedByDomainAndName(groupURIs[i], key, null);
                                    if(orgVal) {
                                        if(newVal == orgVal.value) // not changed
                                            continue;
                                        if(newVal == null)
                                            prefService2.removeByDomainAndName(groupURIs[i], key, null);
                                        else
                                            prefService2.set(groupURIs[i], key, newVal, null);
                                    } else {
                                        if(newVal != null)
                                            prefService2.set(groupURIs[i], key, newVal, null);
                                    }
                                }
                            }
                        }
                    }
                    resolve();
                }
            });
        });
        return promise;
    },

    // Observer for the changes of the prefs

    addObserver: function(url, prefHandler) {
        var prefService2 = Components.classes["@mozilla.org/content-pref/service;1"]
                           .getService(Components.interfaces.nsIContentPrefService2);

        // reduce the call of sync
        var _this = this;
        var queueUpdate = function() {
            if(_this.queueTimeout)
                return;
            _this.queueTimeout = setTimer(false, function() {
                if(_this.queueTimeout) {
                    _this.queueTimeout.cancel();
                    delete _this.queueTimeout;
                }
                _this.sync(url, prefHandler);
            }, 100);
        };

        prefHandler.handler = {
            view: this,
            onContentPrefSet: function(group, name, value) {
                queueUpdate();
            },
            onContentPrefRemoved: function(group, name) {
                queueUpdate();
            }
        }
        for(var key in this.setupDefault)
            prefService2.addObserverForName(key, prefHandler.handler);
        // the observer for the username and the password doesn't work here.
        // is it necessary observe the changes immediately?
        // https://developer.mozilla.org/en/Observer_Notifications#Login_Manager
    },

    removeObserver: function(prefHandler) {
        var prefService2 = Components.classes["@mozilla.org/content-pref/service;1"]
                           .getService(Components.interfaces.nsIContentPrefService2);
        for(var key in this.setupDefault)
            prefService2.removeObserverForName(key, prefHandler.handler);
    },

    sync: function(url, prefHandler) {
        var initial = (typeof(prefHandler.Name) == 'undefined');
        if(!initial)
            this.load(); // read new prefs from the database
        var group = this.findGroup(url);
        for(var key in this.setupDefault) {
            var newVal = this.getVal(group, key, this.setupDefault[key]);
            if(newVal != prefHandler[key]) { // setting is changed
                prefHandler[key] = newVal;
                if(!initial && prefHandler.observer[key]) {
                    prefHandler.observer.handler = prefHandler.observer[key];
                    prefHandler.observer.handler(); // wrap 'this'
                }
            }
        }
    },

    // Processing the Login information
    // https://developer.mozilla.org/En/Using_nsILoginManager

    setLoginInfo: function(show) {
        if(show) {
            this.logins = this.getGroupNames();
            for(var i=0; i<this.groups.length; ++i)
                this.getLoginMsg(this.getVal(i, 'Name', this.setupDefault.Name));
        } else { // hide
            for(var i=0; i<this.logins.length; ++i)
                this.delLoginMsg(this.logins[i]);
            delete this.logins;
            for(var i=0; i<this.groups.length; ++i) {
                this.setLoginMsg(this.getVal(i, 'Name', this.setupDefault.Name));
                for(var key in this.useLoginMgr)
                    this.setVal(i, key, this.setupDefault[key]);
            }
        }
    },

    getLoginMsg: function(groupName) {
        var url = (groupName == this.setupDefault.Name) ? 'chrome://pcmanfx2' : 'telnet://' + groupName;
        var group = this.findGroup(groupName);
        try {
            var logins = Components.classes["@mozilla.org/login-manager;1"]
                                   .getService(Components.interfaces.nsILoginManager)
                                   .findLogins({}, url, 'chrome://pcmanfx2', null);

            for(var key in this.useLoginMgr) {
                this.setVal(group, key, logins.length ?
                    logins[0][this.useLoginMgr[key]] :
                    this.setupDefault[key]);
            }
        } catch(e) {
            for(var key in this.useLoginMgr)
                this.setVal(group, key, this.setupDefault[key]);
        }
    },

    setLoginMsg: function(groupName) {
        this.delLoginMsg(groupName);
        var url = (groupName == this.setupDefault.Name) ? 'chrome://pcmanfx2' : 'telnet://' + groupName;
        var group = this.findGroup(groupName);
        var userPass = {}
        for(var key in this.useLoginMgr)
            userPass[this.useLoginMgr[key]] = this.getVal(group, key, this.setupDefault[key]);
        try {
            var myLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                         Components.interfaces.nsILoginInfo,
                                                         "init");
            var login = new myLoginInfo(url, 'chrome://pcmanfx2', null,
                                        userPass.username, userPass.password, '', '');

            Components.classes["@mozilla.org/login-manager;1"]
                      .getService(Components.interfaces.nsILoginManager)
                      .addLogin(login);
        } catch(e) {}
    },

    delLoginMsg: function(groupName) {
        var url = (groupName == this.setupDefault.Name) ? 'chrome://pcmanfx2' : 'telnet://' + groupName;
        try {
            var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            var logins = loginManager.findLogins({}, url, 'chrome://pcmanfx2', null);

            for (var i = 0; i < logins.length; i++)
                loginManager.removeLogin(logins[i]);
        } catch(e) {}
    }
}

