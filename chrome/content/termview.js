// Terminal View

var uriColor='#FF6600'; // color used to draw URI underline

function TermView(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.buf=null;

    // Cursor
    this.cursorX=0;
    this.cursorY=0;
    this.cursorVisible=true; // false to hide the cursor
    this.cursorShow=false; // blinking state of cursor
    
    this.selection = null;

    this.input = document.getElementById('input_proxy');

    // initialize
    var ctx = this.ctx;
    ctx.fillStyle = "#c0c0c0";
    this.onResize();

    var composition_start ={
        view: this,
        handleEvent: function(e) {
            this.view.onCompositionStart(e);
        }
    };
    this.input.addEventListener('compositionstart', composition_start, false);

    var composition_end ={
        view: this,
        handleEvent: function(e) {
            this.view.onCompositionEnd(e);
        }
    };
    this.input.addEventListener('compositionend', composition_end, false);

    var key_press={
        view: this,
        handleEvent: function(e) {
            this.view.onkeyPress(e);
        }
    };
    addEventListener('keypress', key_press, false);

    var text_input={
        view: this,
        handleEvent: function(e) {
            if(e.target.value) {
                this.view.onTextInput(e.target.value);
            }
            e.target.value='';
        }
    };
    this.input.addEventListener('input', text_input, false);

    var _this=this;
    this.blinkTimeout=setInterval(function(){_this.onBlink();}, 600);
}

function fillClipText(ctx, text, style, maxw, x, y, w, h){
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle=style;
    ctx.fillText(text, x, y, maxw);
    ctx.restore();
}

TermView.prototype={
    conv: Components.classes["@mozilla.org/intl/utf8converterservice;1"]
                                                .getService(Components.interfaces.nsIUTF8ConverterService),

    setBuf: function(buf) {
        this.buf=buf;
    },

    setConn: function(conn) {
        this.conn=conn;
    },

    update: function() {
        this.redraw(false);
    },

    // theoratically, calling drawChar() in redraw() can reduce programming effort and make the code more concise and readable. However, due to poor performance of javascript, we need to prevent unnecessary function calls. If later benchmark showed that this won't affect performence, refactor can be done.

    drawChar: function(row, col, x, y) {
        var chw = this.chw;
        var chh = this.chh;
        var line=this.buf.lines[row];
        var ch = line[col];
        if(!ch.isLeadByte) {
            // if this is second byte of DBCS char
            if(col >=1 && line[col-1].isLeadByte) {
                --col;
                x -= chw;
                ch = line[col];
            }
        }
        var fg = ch.getFg();
        var bg = ch.getBg();
        var ctx = this.ctx;
        ctx.save();

        if(ch.isLeadByte) { // first byte of DBCS char
            var cols = this.buf.cols;
            ++col;
            if(col < cols) {
                var ch2 = line[col]; // second byte of DBCS char
                // draw background color
                ctx.fillStyle=termColors[bg];
                var bg2 = ch2.getBg();
                if(bg = bg2) { // two bytes has the same bg
                    ctx.fillRect(x, y, chw * 2, chh);
                }
                else { // two bytes has different bg
                    ctx.fillRect(x, y, chw, chh); // lead byte
                    ctx.fillStyle=termColors[bg2];
                    ctx.fillRect(x + chw, y, chw, chh); // second byte
                }
                // draw text
                var b5=ch.ch + ch2.ch; // convert char to UTF-8 before drawing
                var u=this.conv.convertStringToUTF8(b5, 'big5',  true);
                if(u) { // can be converted to valid UTF-8
                    var chw2 = chw * 2;
                    var fg2 = ch2.getFg(); // fg of second byte
                    if( fg == fg2 ) { // two bytes have the same fg
                        fillClipText(ctx, u, termColors[fg], chw2, x, y, chw2, chh);
                    }
                    else {
                        // draw first half
                        fillClipText(ctx, u, termColors[fg], chw2, x, y, chw, chh);
                        // draw second half
                        fillClipText(ctx, u, termColors[fg2], chw2, x + chw, y, chw, chh);
                    }
                }
                line[col].needUpdate=false;
            }
        }
        else {
            ctx.fillStyle=termColors[bg];
            ctx.fillRect(x, y, chw, chh);
            // only draw visible chars to speed up
            if(ch.ch > ' ')
                fillClipText(ctx, ch.ch, termColors[fg], chw, x, y, chw, chh);
        }
        ctx.restore();
        ch.needUpdate=false;
    },

    redraw: function(force) {
        var cursorShow=this.cursorShow;
        if(cursorShow)
            this.hideCursor();

        var cols=this.buf.cols;
        var rows=this.buf.rows;
        var ctx = this.ctx;

        var lines = this.buf.lines;
        var old_color = -1;

        for(var row=0; row<rows; ++row) {
            var chh = this.chh;
            var y=row * chh;
            var x = 0;
            var line = lines[row];
            var lineUpdated = false;
            var chw = this.chw;
            for(var col=0; col<cols; ++col) {
                var ch = line[col];
                // FIXME: clipping regions are used extensively
                // when drawing text. This could hurt the performance.
                // However, this is required due to limitations of Firefox.
                if(force || ch.needUpdate) {
                    lineUpdated = true;
                    var fg = ch.getFg();
                    var bg = ch.getBg();
                    if(ch.isLeadByte) { // first byte of DBCS char
                        ++col;
                        if(col < cols) {
                            var ch2 = line[col]; // second byte of DBCS char
                            // draw background color
                            if(bg != old_color) {
                                ctx.fillStyle=termColors[bg];
                                old_color=bg;
                            }
                            var bg2 = ch2.getBg();
                            if(bg = bg2) { // two bytes has the same bg
                                ctx.fillRect(x, y, chw * 2, chh);
                            }
                            else { // two bytes has different bg
                                ctx.fillRect(x, y, chw, chh); // lead byte
                                ctx.fillStyle=termColors[bg2];
                                old_color=bg2;
                                ctx.fillRect(x + chw, y, chw, chh); // second byte
                            }

                            // draw text
                            var b5=ch.ch + ch2.ch; // convert char to UTF-8 before drawing
                            var u=this.conv.convertStringToUTF8(b5, 'big5',  true);
                            if(u) { // can be converted to valid UTF-8
                                var chw2 = chw * 2;
                                var fg2 = ch2.getFg(); // fg of second byte
                                if( fg == fg2 ) { // two bytes have the same fg
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.rect(x, y, chw2, chh);
                                    ctx.closePath();
                                    ctx.clip();
                                    ctx.fillStyle=termColors[fg];
                                    ctx.fillText(u, x, y, chw2);
                                    ctx.restore();
                                }
                                else {
                                    // draw first half
                                    // set clip region
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.rect(x, y, chw, chh);
                                    ctx.closePath();
                                    ctx.clip();
                                    ctx.fillStyle=termColors[fg];
                                    ctx.fillText(u, x, y, chw2);
                                    ctx.restore();

                                    // draw second half
                                    // set clip region
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.rect(x + chw, y, chw, chh);
                                    ctx.closePath();
                                    ctx.clip();
                                    ctx.fillStyle=termColors[fg2];
                                    ctx.fillText(u, x, y, chw2);
                                    ctx.restore();
                                }
                            }
                            x += chw;
                            line[col].needUpdate=false;
                        }
                    }
                    else {
                        if(bg != old_color) {
                            ctx.fillStyle=termColors[bg];
                            old_color=bg;
                        }
                        ctx.fillRect(x, y, chw, chh);
                        // only draw visible chars to speed up
                        if(ch.ch > ' ') {
                            ctx.save();
                            ctx.fillStyle=termColors[fg];
                            // set clip region
                            ctx.beginPath();
                            ctx.rect(x, y, chw, chh);
                            ctx.closePath();
                            ctx.clip();
                            ctx.fillText( ch.ch, x, y, chw );
                            ctx.restore();
                        }
                    }
                    ch.needUpdate=false;
                }
                x += chw;
            }
            // draw underline for links
            if(lineUpdated){
              var uris = line.uris;
              if(uris){
                for (var i=0 ; i<uris.length ; i++) {
                  ctx.save();
                  ctx.strokeStyle = uriColor;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.lineTo( uris[i][0] * chw, y + chh - 1 );
                  ctx.lineTo( uris[i][1] * chw, y + chh - 1 );
                  ctx.stroke();
                  ctx.restore();
                }
              }
              lineUpdated = false;
            }
        }
        if(cursorShow)
            this.showCursor();
    },

    onTextInput: function(text) {
        this.conn.convSend(text, 'big5');
    },

    onkeyPress: function(e) {
        // dump('onKeyPress:'+e.charCode + ', '+e.keyCode+'\n');
        var conn = this.conn;
        if(e.charCode){
            // Control characters
            if(e.ctrlKey && !e.altKey && !e.shiftKey) {
                // Ctrl + @, NUL, is not handled here
                if( e.charCode >= 65 && e.charCode <=90 ) { // A-Z
                    conn.send( String.fromCharCode(e.charCode - 64) );
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                else if( e.charCode >= 97 && e.charCode <=122 ) { // a-z
                    conn.send( String.fromCharCode(e.charCode - 96) );
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }
        else if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
            switch(e.keyCode){
            case 8:
                conn.send('\b');
                break;
            case 9:
                conn.send('\t');
                // don't move input focus to next control
                e.preventDefault();
                e.stopPropagation();
                break;
            case 13:
                conn.send('\r');
                break;
            case 27: //ESC
                conn.send('\x1b');
                break;
            case 33: //Page Up
                conn.send('\x1b[5~');
                break;
            case 34: //Page Down
                conn.send('\x1b[6~');
                break;
            case 35: //End
                conn.send('\x1b[4~');
                break;
            case 36: //Home
                conn.send('\x1b[1~');
                break;
            case 37: //Arrow Left
                conn.send('\x1b[D');
                break;
            case 38: //Arrow Up
                conn.send('\x1b[A');
                break;
            case 39: //Arrow Right
                conn.send('\x1b[C');
                break;
            case 40: //Arrow Down
                conn.send('\x1b[B');
                break;
            case 45: //Insert
                conn.send('\x1b[2~');
                break;
            case 46: //DEL
                conn.send('\x1b[3~');
                break;
            }
        }
    },

    onResize: function() {
        var ctx = this.ctx;
        this.chh = Math.floor(this.canvas.height / 24);
        var font = this.chh + 'px monospace';
        ctx.font= font;
        ctx.textBaseline='top';

        var m=ctx.measureText('　'); //全形空白
        this.chw=Math.round(m.width/2);
        
        // if overflow, resize canvas again
        var win = document.getElementById('topwin');
        var overflowX = (this.chw * 80) - win.clientWidth;
        if(overflowX > 0) {
          this.canvas.width = win.clientWidth;
          this.chw = Math.floor(this.canvas.width / 80);
          this.chh = this.chw*2;  // is it necessary to measureText?
          font = this.chh + 'px monospace';
          ctx.font= font;
          this.canvas.height = this.chh * 24;
        }

        if(this.buf) {
            this.canvas.width = this.chw * this.buf.cols;
            // font needs to be reset after resizing canvas
            ctx.font= font;
            ctx.textBaseline='top';
            this.redraw(true);
        }
        else {
            // dump(this.chw + ', ' + this.chw * 80 + '\n');
            this.canvas.width = this.chw * 80;
            // font needs to be reset after resizing canvas
            ctx.font= font;
            ctx.textBaseline='top';
        }

        this.updateCursorPos();
        // should we set cursor height according to chh?
        this.setCursorSize(this.chw, 2);
        
        this.updateSelection();
    },

    // Cursor
    setCursorSize: function(w, h){
        var visible=this.cursorVisible;
        if(visible)
            this.hideCursor();
        this.cursorW=w;
        this.cursorH=h;
        if(visible)
            this.showCursor();
    },

    updateCursorPos: function(){
        var visible=this.cursorVisible;
        if(visible)
            this.hideCursor();
        if(this.buf) {
            this.cursorX=this.buf.cur_x * this.chw;
            this.cursorY=(this.buf.cur_y + 1)*this.chh - this.cursorH;
        }
        else {
            this.cursorX=0;
            this.cursorY=this.chh - this.cursorH;
        }
        if(visible)
            this.showCursor();
    },

    onCompositionStart: function(e) {
        var top = (this.buf.cur_y + 1) * this.chh;
        this.input.style.top = ( top + this.input.clientHeight > this.canvas.clientHeight ? top - this.input.clientHeight : top ) + 'px';
        this.input.style.left = (this.canvas.offsetLeft + this.buf.cur_x * this.chw ) + 'px';
    },
    
    onCompositionEnd: function(e) {
      this.input.style.top = '-100px';
    },

    onBlink: function(){
        // dump('blink\n');
        this.blinkShow=!this.blinkShow;
        // FIXME: draw blinking characters

        if(this.cursorVisible){
            this.cursorShow=!this.cursorShow;
            this.drawCursor();
        }
    },

    showCursor: function(){
        this.cursorVisible=true;
        if( !this.cursorShow ){
            this.cursorShow=true;
            this.drawCursor();
        }
    },

    hideCursor: function(){
        if(this.cursorShow){ // the cursor is currently shown
            this.cursorShow=false;
            this.drawCursor();
        }
        this.cursorVisible=false;
    },

    drawCursor: function(){
        var ctx=this.ctx;
        // dump('drawCursor\n');
        var row = Math.floor(this.cursorY / this.chh);
        var col = Math.floor(this.cursorX / this.chw);
        if(this.cursorShow) {
            if(this.buf) {
                var ch=this.buf.lines[row][col];
                var fg=ch.getFg();
                ctx.save();
                ctx.fillStyle=termColors[fg];
                ctx.fillRect(this.cursorX, this.cursorY, this.cursorW, this.cursorH);
                ctx.restore();
            }
            else {
                
            }
        }
        else {
            if(this.buf) {
                // dump(row + ', ' + col + '\n');
                var line = this.buf.lines[row]; 
                if(!line[col].needUpdate)
                    this.drawChar(row, col, this.cursorX, row * this.chh);
                    if(line.uris) { // has URI in this line
                        var n=line.uris.length;
                        for(var i=0; i<n;++i) {
                            var uri=line.uris[i];
                            if(uri[0] <= col && uri[1] > col) { // the char is part of a URI
                                // draw underline for URI.
                                ctx.strokeStyle = uriColor;
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                var y = (row + 1) * this.chh - 1;
                                var x = col * this.chw;
                                ctx.lineTo(x, y);
                                ctx.lineTo(x + this.chw, y);
                                ctx.stroke();
                            }
                        }
                    }
            }
            else {
                
            }
        }
        /*
        // FIXME: this has very poor performance on Linux
        var img=ctx.getImageData(this.cursorX, this.cursorY, this.cursorW, this.cursorH);
        var src=img.data;
        img=ctx.createImageData(this.cursorW, this.cursorH);
        var px=img.data;
        // invert the image
        for(var i = 0, n = px.length; i < n; i += 4) {
            px[i] = 255 - src[i];
            px[i+1] = 255 - src[i+1];
            px[i+2] = 255 - src[i+2];
            px[i+3] = 255;
        }
        ctx.putImageData(img, this.cursorX, this.cursorY);
        */
    },
    
    updateSelection: function(){
      var box = document.getElementById('selection');
      if(!this.selection) {
        box.style.display = 'none';
        return;
      }
      box.textContent = this.selection.text;
      box.style.font = this.chh + 'px monospace';
      box.style.top = ( this.canvas.offsetTop + this.selection.rowStart * this.chh ) + 'px';
      box.style.left = ( this.canvas.offsetLeft + this.selection.colStart * this.chw ) + 'px';
      window.getSelection().selectAllChildren(box);
      box.style.display = 'block';
    },

    clientToCursor: function(cX, cY){
      var x = cX - this.canvas.offsetLeft;
      var y = cY - this.canvas.offsetTop;
      var col = Math.floor(x / this.chw);
      var row = Math.floor(y / this.chh);
      if(row < this.buf.rows){
        return {col: col, row: row};
      }
      else  // client Y out of "rows" range (it's possible since we don't resize canvas height to fit chh*24)
        return false;
    }
}
