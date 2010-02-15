(function(window, undefined) {
    function xhr() { 
        return window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest(); 
    }
    
    window.Channel = function Channel(id) {
        var listeners = [], lastInfoId = 0;
        
        function listen() {        
            var client = xhr(),
                url = [ "/channel/", id, "/read?info-id=", lastInfoId ].join("");
                
            client.open("GET", url);
            client.onreadystatechange = function() {            
                if(this.readyState !== 4) { return; }
                
                if(this.status !== 200) { listen(); return; }
                
                if(this.responseText) {
                    var info = JSON.parse(this.responseText);
                    
                    for(var i = 0; i < info.length; i++) {
                        for(var j = 0; j <  listeners.length; j++) { listeners[j](info[i].message); }
                        
                        if(info[i].infoId > lastInfoId) { lastInfoId = info[i].infoId; }
                    }
                }
                
                listen();
            };
            client.send();
        }
        
        this.id = id;
        
        this.addListener = function addListener(l) { listeners.push(l); };
        
        this.start = function start() { listen(); };
        
        this.send = (function() { 
            var queue = [], inflight = false;
            
            function _send(msg) {
                var client = xhr(),
                    url = [ "/channel/", id, "/send?msg=", encodeURIComponent(msg) ].join("");
                client.open("GET", url);
                client.onreadystatechange = function() {
                    if(this.readyState !== 4) { return; }
                    
                    var infoId = parseInt(this.responseText, 10) || 0;
                    
                    if(infoId > lastInfoId) { lastInfoId = infoId; }
                    
                    if(queue.length > 0) { _send(queue.shift()); }
                    else { inflight = false; }
                };
                client.send();
                
                inflight = true;
            }
            
            return function send(msg) {
                if(inflight) { queue.push(JSON.stringify(msg)); }
                else { _send(JSON.stringify(msg)); }
            };
        })();
    };
    
    Channel.prototype.clear = function clear() {
        this.send({ clear: "true" });
    };
})(window);