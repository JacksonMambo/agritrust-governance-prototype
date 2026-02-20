/*! qrcode-generator (minimal) - adapted for demo; produces QR Code as canvas. */
(function(g){
  function QR8bitByte(data){this.mode=1;this.data=data;this.parsed=[];for(var i=0;i<data.length;i++){this.parsed.push(data.charCodeAt(i));}}
  QR8bitByte.prototype={getLength:function(){return this.parsed.length;},write:function(buf){for(var i=0;i<this.parsed.length;i++){buf.put(this.parsed[i],8);}}};
  function BitBuffer(){this.buffer=[];this.length=0;}
  BitBuffer.prototype={get:function(i){var b=Math.floor(i/8);return ((this.buffer[b]>>> (7-i%8))&1)==1;},
    put:function(num,len){for(var i=0;i<len;i++){this.putBit(((num>>> (len-i-1))&1)==1);} },
    putBit:function(bit){var b=Math.floor(this.length/8);if(this.buffer.length<=b){this.buffer.push(0);}if(bit){this.buffer[b]|=(0x80>>> (this.length%8));}this.length++;}
  };
  // Very small QR: fixed version=4, error correction=L (good for short payloads)
  // This is a demo-quality generator, not for large payloads.
  function QRCode(data){
    this.typeNumber=4; this.errorCorrectLevel=1; // L
    this.modules=null; this.moduleCount=0;
    this.dataList=[new QR8bitByte(data)];
    this.make();
  }
  QRCode.prototype={
    make:function(){
      this.moduleCount=this.typeNumber*4+17;
      this.modules=new Array(this.moduleCount);
      for(var r=0;r<this.moduleCount;r++){this.modules[r]=new Array(this.moduleCount);for(var c=0;c<this.moduleCount;c++){this.modules[r][c]=null;}}
      this.setupPositionProbePattern(0,0);
      this.setupPositionProbePattern(this.moduleCount-7,0);
      this.setupPositionProbePattern(0,this.moduleCount-7);
      this.setupTimingPattern();
      this.mapData(this.createData(),0);
    },
    setupPositionProbePattern:function(row,col){
      for(var r=-1;r<=7;r++){
        if(row+r<=-1||this.moduleCount<=row+r)continue;
        for(var c=-1;c<=7;c++){
          if(col+c<=-1||this.moduleCount<=col+c)continue;
          if((0<=r&&r<=6&&(c==0||c==6))||(0<=c&&c<=6&&(r==0||r==6))||(2<=r&&r<=4&&2<=c&&c<=4)){
            this.modules[row+r][col+c]=true;
          }else{
            this.modules[row+r][col+c]=false;
          }
        }
      }
    },
    setupTimingPattern:function(){
      for(var i=8;i<this.moduleCount-8;i++){
        if(this.modules[i][6]===null)this.modules[i][6]=(i%2==0);
        if(this.modules[6][i]===null)this.modules[6][i]=(i%2==0);
      }
    },
    createData:function(){
      var buffer=new BitBuffer();
      buffer.put(4,4); // mode byte
      buffer.put(this.dataList[0].getLength(),8);
      this.dataList[0].write(buffer);
      // terminator
      buffer.put(0,4);
      // pad to byte
      while(buffer.length%8!=0)buffer.putBit(false);
      // pad bytes to a small fixed length (demo)
      var totalBytes=80; // enough for short payloads in v4-L (demo)
      var padBytes=[0xec,0x11]; var p=0;
      while(buffer.buffer.length<totalBytes){
        buffer.put(padBytes[p%2],8); p++;
      }
      return buffer;
    },
    mapData:function(data,maskPattern){
      var inc=-1; var row=this.moduleCount-1; var bitIndex=0; var byteIndex=0;
      for(var col=this.moduleCount-1;col>0;col-=2){
        if(col==6)col--;
        while(true){
          for(var c=0;c<2;c++){
            if(this.modules[row][col-c]===null){
              var dark=false;
              if(byteIndex<data.buffer.length){
                dark=((data.buffer[byteIndex]>>> (7-bitIndex))&1)==1;
              }
              var mask=((row+col)%2==0);
              this.modules[row][col-c]=mask? !dark: dark;
              bitIndex++;
              if(bitIndex==8){byteIndex++;bitIndex=0;}
            }
          }
          row+=inc;
          if(row<0||this.moduleCount<=row){row-=inc;inc=-inc;break;}
        }
      }
    },
    isDark:function(r,c){return this.modules[r][c];}
  };

  function toCanvas(text, size, canvas){
    var qr=new QRCode(text);
    var count=qr.moduleCount;
    canvas.width=size; canvas.height=size;
    var ctx=canvas.getContext("2d");
    var tile=size/count;
    for(var r=0;r<count;r++){
      for(var c=0;c<count;c++){
        ctx.fillStyle=qr.isDark(r,c) ? "#111" : "#fff";
        var w=Math.ceil((c+1)*tile)-Math.floor(c*tile);
        var h=Math.ceil((r+1)*tile)-Math.floor(r*tile);
        ctx.fillRect(Math.round(c*tile),Math.round(r*tile),w,h);
      }
    }
  }

  g.QRDemo={toCanvas:toCanvas};
})(window);
