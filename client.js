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
                
                if(this.responseText) {
                    var data = JSON.parse(this.responseText);
                    
                    for(var i = 0; i < data.length; i++) {
                        for(var j = 0; j <  listeners.length; j++) { listeners[j](data[i].message); }
                        
                        if(data[i].infoId > lastInfoId) { lastInfoId = data[i].infoId; }
                    }
                }
                
                listen();
            };
            client.send();
        }
        
        this.id = id;
        
        this.addListener = function addListener(l) { listeners.push(l); };
        
        this.start = function start() { listen(); };
        
        this.send = function send(msg) {
            var client = xhr(),
                url = [ "/channel/", this.id, "/send?msg=", encodeURIComponent(JSON.stringify(msg)) ].join("");
            client.open("GET", url);
            client.onreadystatechange = function() {
                if(this.readyState !== 4) { return; }
                
                var infoId = parseInt(this.responseText, 10) || 0;
                
                if(infoId > lastInfoId) { lastInfoId = infoId; }
            };
            client.send();
        };
    };
})(window);