(function(window, undefined) {
    function xhr() { 
        return window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest(); 
    }
    
    function _send(id, msg) {
    }
    
    window.Channel = function Channel(id) {
        var listeners = [];
        
        function listen() {        
            var client = xhr(),
                url = [ "/channel/", id, "/read?info-id=9999999999" ].join("");
                
            client.open("GET", url);
            client.onreadystatechange = function() {
                if(this.readyState == 4) {                
                    if(this.responseText) {
                        var messages = JSON.parse(this.responseText);
                        
                        for(var i = 0; i <  listeners.length; i++) { listeners[i](messages); }
                    }
                    
                    listen();
                }
            };
            client.send();
        }
        
        this.id = id;
        this.addListener = function addListener(l) { listeners.push(l); };
        
        listen();
    };
    
    Channel.prototype.send = function send(msg) {
        var client = xhr(),
            url = [ "/channel/", this.id, "/send?msg=", encodeURIComponent(JSON.stringify(msg)) ].join("");
        client.open("GET", url);
        client.send();
    };
})(window);