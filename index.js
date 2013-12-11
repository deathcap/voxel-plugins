var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

module.exports = function(game, opts) {
  return new Plugins(game, opts);
};

function Plugins(game, opts) {
  this.game = game;
  this.game.plugins = this;

  opts = opts || {};
  this.require = opts.require || require;
  this.namePrefix = opts.namePrefix || "voxel-";

  // map plugin name to instances
  this.pluginMap = {};

  this.preconfigureOpts = {};
}

// Loads a plugin instance
Plugins.prototype.load = function(name, opts) {
  if (this.get(name)) {
    console.log("plugin already loaded: ", name);
    return false;
  }

  opts = opts || {};
  
  var createPlugin = this.require(this.namePrefix + name);   // factory for constructor
  if (!createPlugin) {
    console.log("plugin not found: ",name);
    return false;
  }

  try {
    var plugin = createPlugin(this.game, opts); // requires (game, opts) convention
    if (!plugin) {
      console.log("create plugin failed:",name,createPlugin,plugin);
      return false;
    }
  } catch (e) {
    console.log("create plugin failed with exception:",name,createPlugin,plugin,e);
    return false;
  }
  plugin.pluginName = name;

  // plugins are enabled on load -- assumed constructor calls its own enable() method (if present)
  plugin.pluginEnabled = true;
  this.emit('plugin enabled', name);

  this.pluginMap[name] = plugin;

  console.log("Loaded plugin:",name,plugin);


  return plugin;
};

// Mark a plugin for on-demand loading in enable(), with given preconfigured options
Plugins.prototype.preconfigure = function(name, opts) {
  this.preconfigureOpts[name] = opts;
};


// Get a loaded plugin instance by name or instance
Plugins.prototype.get = function(name) {
  if (typeof name === "string")
    return this.pluginMap[name];
  else
    // assume it is a plugin instance already, return as-is
    return name;
};

Plugins.prototype.isEnabled = function(name) {
  var plugin = this.get(name);

  return !!(plugin && plugin.pluginEnabled);
};

Plugins.prototype.isLoaded = function(name) {
  var plugin = this.get(name);

  return !!(plugin && plugin.pluginName && this.pluginMap[plugin.pluginName]);
};

// Get list of enabled plugins
Plugins.prototype.list = function() {
  var self = this;
  return this.listAll().filter(function(plugin) { return self.isEnabled(plugin); });
};

// Get list of all plugins
Plugins.prototype.listAll = function() {
  return Object.keys(this.pluginMap);
};


Plugins.prototype.enable = function(name) {
  var plugin = this.get(name);

  if (!plugin) {
    if (this.preconfigureOpts[name]) {
      // on-demand loading, with prespecified options
      return this.load(name, this.preconfigureOpts[name]);
    } else {
      console.log("no such plugin loaded to enable: ",plugin,name);
    }

    return false;
  } else {
    if (plugin.pluginEnabled) {
      console.log("already enabled: ",plugin,name);
      return false;
    }

    if (plugin.enable) {
      try {
        plugin.enable();
      } catch(e) {
        console.log("failed to enable:",plugin,name,e);
        return false;
      }
    }
    plugin.pluginEnabled = true;
    this.emit('plugin enabled', name);
  }
  return true;
};

Plugins.prototype.disable = function(name) {
  console.log("disabling plugin ",name);
  var plugin = this.get(name);

  if (!plugin) {
    console.log("no such plugin loaded to disable: ",plugin,name);
    return false;
  }
  if (!this.isEnabled(plugin)) {
    console.log("already disabled: ",plugin,name);
    return false;
  }

  if (plugin.disable) {
    try {
      plugin.disable(); 
    } catch (e) {
      console.log("failed to disable:",plugin,name,e);
      return false;
    }
  }

  plugin.pluginEnabled = false;
  this.emit('plugin disabled', name);

  // TODO: recursively disable dependants? or refuse to disable if has enabled dependants?
  return true;
};

Plugins.prototype.toggle = function(name) {
  if (this.isEnabled(name)) {
    return this.disable(name);
  } else {
    return this.enable(name);
  }
};

Plugins.prototype.unload = function(name) {
  var plugin = this.get(name);

  if (!plugin) {
    console.log("no plugin",plugin,name);
    return false;
  }

  if (!this.pluginMap[plugin.pluginName]) {
    console.log("no such plugin to unload: ",plugin);
    return false;
  }

  if (this.isEnabled(plugin))
    this.disable(plugin);

  delete this.pluginMap[plugin.pluginName];
  console.log("unloaded ",plugin);

  return true;
};

inherits(Plugins, EventEmitter);
