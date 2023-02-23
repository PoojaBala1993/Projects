//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// ColoredMultiObject.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//    --converted from 2D to 4D (x,y,z,w) vertices
//    --demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//    --demonstrate 'nodes' vs. 'vertices'; geometric corner locations where
//				OpenGL/WebGL requires multiple co-located vertices to implement the
//				meeting point of multiple diverse faces.
//    --Simplify fcn calls: make easy-access global vars for gl,g_nVerts, etc.
//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
//  '#ifdef GL_ES\n' +					
  'precision mediump float;\n' +
//  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Easy-Access Global Variables-----------------------------
// (simplifies function calls. LATER: merge them into one 'myApp' object)
var ANGLE_STEP = 10.0;  // -- Rotation angle rate (degrees/second)
var gl;                 // WebGL's rendering context; value set in main()
var g_nVerts;           // # of vertices in VBO; value set in main()



var g_lastMS = Date.now();	

//------------For mouse click-and-drag: -------------------------------
var g_isDrag = false;		// mouse-drag: true when user holds down mouse button
var g_xMclik = 0.0;			// last mouse button-down position (in CVV coords)
var g_yMclik = 0.0;
var g_xMdragTot = 0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var g_yMdragTot = 0.0;
var g_digits = 5;			// DIAGNOSTICS: # of digits to print in console.log (


var g_angle0now = 0.0;       // init Current rotation angle, in degrees
var g_angle0rate = -22.0;       // init Rotation angle rate, in degrees/second.
var g_angle0brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle0min = -140.0;       // init min, max allowed angle, in degrees.
var g_angle0max = 40.0;
//---------------
var g_angle1now = 180.0; 			// init Current rotation angle, in degrees > 0
var g_angle1rate = 64.0;				// init Rotation angle rate, in degrees/second.
var g_angle1brake = 1.0;				// init Rotation start/stop. 0=stop, 1=full speed.
var g_angle1min = -30.0;       // init min, max allowed angle, in degrees
var g_angle1max = 200.0;
//---------------
var g_angle2now = 0.0; 			// init Current rotation angle, in degrees.
var g_angle2rate = 89.0;				// init Rotation angle rate, in degrees/second.
var g_angle2brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle2min = -40.0;       // init min, max allowed angle, in degrees
var g_angle2max = -20.0;

var g_angle3now = 0.0; 			// init Current rotation angle, in degrees.
var g_angle3rate = 31.0;				// init Rotation angle rate, in degrees/second.
var g_angle3brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle3min = -40.0;       // init min, max allowed angle, in degrees
var g_angle3max = 40.0;

var g_angle4now = 0.0; 			// init Current rotation angle, in degrees.
var g_angle4rate = 10.0;				// init Rotation angle rate, in degrees/second.
var g_angle4brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle4min = -40.0;       // init min, max allowed angle, in degrees
var g_angle4max = 40.0;

var modelMatrix;
var u_ModelLoc;


function main() {
//==============================================================================
  // Retrieve <canvas> element we created in HTML file:
  var myCanvas = document.getElementById('HTML5_canvas');

  // Get rendering context from our HTML-5 canvas needed for WebGL use.
 	// Success? if so, all WebGL functions are now members of the 'gl' object.
 	// For example, gl.clearColor() calls the WebGL function 'clearColor()'.
  gl = getWebGLContext(myCanvas);
  if (!gl) {
    console.log('Failed to get the WebGL rendering context from myCanvas');
    return;
  }

  // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.9, 1.0, 1.0);
  
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Create a Vertex Buffer Object (VBO) in the GPU, and then fill it with
  // g_nVerts vertices.  (builds a float32array in JS, copies contents to GPU)
  g_nVerts = initVertexBuffer();
  if (g_nVerts < 0) {
    console.log('Failed to set the vertex information');
    return;
    }

    window.addEventListener("keydown", myKeyDown, false);
    // After each 'keydown' event, call the 'myKeyDown()' function.  The 'false' 
    // arg (default) ensures myKeyDown() call in 'bubbling', not 'capture' stage)
    // ( https://www.w3schools.com/jsref/met_document_addeventlistener.asp )
    window.addEventListener("keyup", myKeyUp, false);
    // Called when user RELEASES the key.  Now rarely used...

    // MOUSE:
    // Create 'event listeners' for a few vital mouse events 
    // (others events are available too... google it!).  
    myCanvas.addEventListener("mousedown", myMouseDown);
    // (After each 'mousedown' event, browser calls the myMouseDown() fcn.)
    myCanvas.addEventListener("mousemove", myMouseMove);
    myCanvas.addEventListener("mouseup", myMouseUp);
    myCanvas.addEventListener("click", myMouseClick);
    myCanvas.addEventListener("dblclick", myMouseDblClick); 

	// NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
//	gl.depthFunc(gl.LESS);
	gl.enable(gl.DEPTH_TEST); 	  
	
  // Create, init current rotation angle value in JavaScript
    var currentAngle = 0.0;
    

  // Get handle to graphics system's storage location of u_ModelMatrix
  u_ModelLoc = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelLoc) { 
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }
  // Create a local version of our model matrix in JavaScript 
  modelMatrix = new Matrix4();
  // Constructor for 4x4 matrix, defined in the 'cuon-matrix-quat03.js' library
  // supplied by your textbook.  (Chapter 3)
  
  
  
  // Transfer modelMatrix values to the u_ModelMatrix variable in the GPU
   gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
   
//-----------------  DRAW STUFF!
  //---------------Beginner's method: DRAW ONCE and END the program.
  // (makes a static, non-responsive image)

  // says to WebGL: draw these vertices held in the currently-bound VBO.

  //---------------Interactive Animation: draw repeatedly
  // Create an endlessly repeated 'tick()' function by this clever method:
  // a)  Declare the 'tick' variable whose value is this function:

    var tick = function () {

        requestAnimationFrame(tick, myCanvas);
        timerAll();
      //currentAngle = animate(currentAngle);// Update the rotation angle
      //timerAll();  
    draw();   // Draw shapes
    
      
    									// Request that the browser re-draw the webpage
  };
  // AFTER that, call the function.
  tick();							

}     


function timerAll() {
    //=============================================================================
    // Find new values for all time-varying parameters used for on-screen drawing.
    // HINT: this is ugly, repetive code!  Could you write a better version?
    // 			 would it make sense to create a 'timer' or 'animator' class? Hmmmm...
    //
    // use local variables to find the elapsed time:
    var nowMS = Date.now();             // current time (in milliseconds)
    var elapsedMS = nowMS - g_lastMS;   // 
    g_lastMS = nowMS;                   // update for next webGL drawing.
    if (elapsedMS > 1000.0) {
        // Browsers won't re-draw 'canvas' element that isn't visible on-screen 
        // (user chose a different browser tab, etc.); when users make the browser
        // window visible again our resulting 'elapsedMS' value has gotten HUGE.
        // Instead of allowing a HUGE change in all our time-dependent parameters,
        // let's pretend that only a nominal 1/30th second passed:
        elapsedMS = 1000.0 / 30.0;
    }
    // Find new time-dependent parameters using the current or elapsed time:
    g_angle0now += g_angle0rate * g_angle0brake * (elapsedMS * 0.001);	// update.
    g_angle1now += g_angle1rate * g_angle1brake * (elapsedMS * 0.001);
    g_angle2now += g_angle2rate * g_angle2brake * (elapsedMS * 0.001);
    g_angle4now += g_angle4rate * g_angle4brake * (elapsedMS * 0.001);
    // apply angle limits:  going above max, or below min? reverse direction!
    // (!CAUTION! if max < min, then these limits do nothing...)
    if ((g_angle0now >= g_angle0max && g_angle0rate > 0) || // going over max, or
        (g_angle0now <= g_angle0min && g_angle0rate < 0)) // going under min ?
        g_angle0rate *= -1;	// YES: reverse direction.
    if ((g_angle1now >= g_angle1max && g_angle1rate > 0) || // going over max, or
        (g_angle1now <= g_angle1min && g_angle1rate < 0))	 // going under min ?
        g_angle1rate *= -1;	// YES: reverse direction.
    if ((g_angle2now >= g_angle2max && g_angle2rate > 0) || // going over max, or
        (g_angle2now <= g_angle2min && g_angle2rate < 0))	 // going under min ?
        g_angle2rate *= -1;	// YES: reverse direction.
    if ((g_angle3now >= g_angle3max && g_angle3rate > 0) || // going over max, or
        (g_angle3now <= g_angle3min && g_angle3rate < 0))	 // going under min ?
        g_angle3rate *= -1;	// YES: reverse direction.
    if ((g_angle4now >= g_angle4max && g_angle4rate > 0) || // going over max, or
        (g_angle4now <= g_angle4min && g_angle4rate < 0))	 // going under min ?
        g_angle4rate *= -1;	// YES: reverse direction.
    // *NO* limits? Don't let angles go to infinity! cycle within -180 to +180.
    if (g_angle0min > g_angle0max) {// if min and max don't limit the angle, then
        if (g_angle0now < -180.0) g_angle0now += 360.0;	// go to >= -180.0 or
        else if (g_angle0now > 180.0) g_angle0now -= 360.0;	// go to <= +180.0
    }
    if (g_angle1min > g_angle1max) {
        if (g_angle1now < -180.0) g_angle1now += 360.0;	// go to >= -180.0 or
        else if (g_angle1now > 180.0) g_angle1now -= 360.0;	// go to <= +180.0
    }
    if (g_angle2min > g_angle2max) {
        if (g_angle2now < -180.0) g_angle2now += 360.0;	// go to >= -180.0 or
        else if (g_angle2now > 180.0) g_angle2now -= 360.0;	// go to <= +180.0
    }
    if (g_angle3min > g_angle3max) {
        if (g_angle3now < -180.0) g_angle3now += 360.0;	// go to >= -180.0 or
        else if (g_angle3now > 180.0) g_angle3now -= 360.0;	// go to <= +180.0
    }
    if (g_angle4min > g_angle4max) {
        if (g_angle4now < -180.0) g_angle4now += 360.0;	// go to >= -180.0 or
        else if (g_angle4now > 180.0) g_angle4now -= 360.0;	// go to <= +180.0
    }
}



var r1 = 0.9;
var b1 = 0.2;
var g1 = 0.1;

var r2 = 0.5;
var b2 = 0.2;
var g2 = 0.9;

var r3 = 0.8;
var b3 = 0.5;
var g3 = 0.1;



function initVertexBuffer() {
					 

  var colorShapes = new Float32Array([
      0.2529241935852210, -0.39418626053186300, -0.08876815454848250, 1.0, r2, b2, g2,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      -0.26113733957860400, -0.050644563354743500, -0.5678253707841000, 1.0, r1, b1, g1,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      0.2529241935852210, -0.39418626053186300, -0.08876815454848250, 1.0, r2, b2, g2,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      0.2529241935852210, -0.39418626053186300, -0.08876815454848250, 1.0, r2, b2, g2,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.2529241935852210, -0.39418626053186300, -0.08876815454848250, 1.0, r2, b2, g2,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      -0.26113733957860400, -0.050644563354743500, -0.5678253707841000, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      0.44927406877555300, -0.05064434534182980, -0.8639065287073680, 1.0, r2, b2, g2,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      0.8883376553485080, -0.050641838193322700, -0.08876815454848250, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.44927442304653800, -0.05064450885151510, 0.6863703286168600, 1.0, r2, b2, g2,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      -0.2611367945463200, -0.05064461785797190, 0.390289388706506, 1.0, r1, b1, g1,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      -0.26113733957860400, -0.050644563354743500, -0.5678253707841000, 1.0, r1, b1, g1,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      0.44927406877555300, -0.05064434534182980, -0.8639065287073680, 1.0, r2, b2, g2,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      0.8883376553485080, -0.050641838193322700, -0.08876815454848250, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.44927442304653800, -0.05064450885151510, 0.6863703286168600, 1.0, r2, b2, g2,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      -0.2611367945463200, -0.05064461785797190, 0.390289388706506, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      0.056573642554856200, 0.5052322772260930, -0.8639065287073680, 1.0, r2, b2, g2,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      0.7669851272135330, 0.5052324080338420, -0.5678259158163850, 1.0, r3, b3, g3,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.766985290723218, 0.5052323099280300, 0.3902891161903640, 1.0, r3, b3, g3,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.030108891455022000, 0.4163641692070170, 0.6937568786480720, 1.0, r2, b2, g2,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      -0.3824893226812950, 0.5052296174685460, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      0.2529238665658500, 0.8487740888599930, -0.08876815454848250, 1.0, r2, b2, g2,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      0.030108891455022000, 0.4163641692070170, 0.6937568786480720, 1.0, r2, b2, g2,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      0.2529238665658500, 0.8487740888599930, -0.08876815454848250, 1.0, r2, b2, g2,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.1375128443670670, 0.7559584155628080, 0.3668432444093180, 1.0, r2, b2, g2,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.766985290723218, 0.5052323099280300, 0.3902891161903640, 1.0, r3, b3, g3,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.2529238665658500, 0.8487740888599930, -0.08876815454848250, 1.0, r2, b2, g2,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.47862990002418300, 0.7452895721098700, 0.10872756381415100, 1.0, r2, b2, g2,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.7669851272135330, 0.5052324080338420, -0.5678259158163850, 1.0, r3, b3, g3,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.2529238665658500, 0.8487740888599930, -0.08876815454848250, 1.0, r2, b2, g2,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      0.5550796273091040, 0.7559585790724940, -0.37034927358369700, 1.0, r3, b3, g3,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      0.056573642554856200, 0.5052322772260930, -0.8639065287073680, 1.0, r2, b2, g2,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      0.2529238665658500, 0.8487740888599930, -0.08876815454848250, 1.0, r2, b2, g2,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      0.1375126263541530, 0.755958524569265, -0.5443797170159680, 1.0, r2, b2, g2,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      -0.12056261284552800, 0.7559571619885550, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.3824893226812950, 0.5052296174685460, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.3824893226812950, 0.5052296174685460, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540282600329410, 0.3668451520223120, 1.0, r1, b1, g1,
      0.030108891455022000, 0.4163641692070170, 0.6937568786480720, 1.0, r2, b2, g2,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      0.030108891455022000, 0.4163641692070170, 0.6937568786480720, 1.0, r2, b2, g2,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      0.512200106204991, 0.4364008095473520, 1.0, 1.0, r3, b3, g3,
      0.766985290723218, 0.5052323099280300, 0.3902891161903640, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.766985290723218, 0.5052323099280300, 0.3902891161903640, 1.0, r3, b3, g3,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.8572370231492110, 0.5540285325490830, -0.08876815454848250, 1.0, r3, b3, g3,
      0.7669851272135330, 0.5052324080338420, -0.5678259158163850, 1.0, r3, b3, g3,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.7669851272135330, 0.5052324080338420, -0.5678259158163850, 1.0, r3, b3, g3,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      0.439669836883283, 0.5540297861233370, -0.8259657413417400, 1.0, r2, b2, g2,
      0.056573642554856200, 0.5052322772260930, -0.8639065287073680, 1.0, r2, b2, g2,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      0.056573642554856200, 0.5052322772260930, -0.8639065287073680, 1.0, r2, b2, g2,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      -0.23597592417990500, 0.5540283145361690, -0.5443813521128210, 1.0, r1, b1, g1,
      -0.3824893226812950, 0.5052296174685460, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      0.030108891455022000, 0.4163641692070170, 0.6937568786480720, 1.0, r2, b2, g2,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      -0.13301496544195500, 0.26071820975207700, 0.3876477262315920, 1.0, r1, b1, g1,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      0.2124312925489670, 0.19965470024668700, 0.7344497520293870, 1.0, r2, b2, g2,
      0.44927442304653800, -0.05064450885151510, 0.6863703286168600, 1.0, r2, b2, g2,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      0.766985290723218, 0.5052323099280300, 0.3902891161903640, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.6704960998307290, 0.22729394141567900, 0.41224072746113000, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      0.9285698674432430, 0.2272939959189070, 0.1928142180609850, 1.0, r3, b3, g3,
      0.8883376553485080, -0.050641838193322700, -0.08876815454848250, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.7669851272135330, 0.5052324080338420, -0.5678259158163850, 1.0, r3, b3, g3,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.9285697584367870, 0.22729410492536400, -0.37035090868054900, 1.0, r3, b3, g3,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.6704958273145870, 0.22729405042213600, -0.8259706466322970, 1.0, r3, b3, g3,
      0.44927406877555300, -0.05064434534182980, -0.8639065287073680, 1.0, r2, b2, g2,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      0.056573642554856200, 0.5052322772260930, -0.8639065287073680, 1.0, r2, b2, g2,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      0.2529238120626220, 0.2272939959189070, -1.0, 1.0, r2, b2, g2,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      -0.16464809418288700, 0.22729388691245100, -0.8259701016000130, 1.0, r1, b1, g1,
      -0.26113733957860400, -0.050644563354743500, -0.5678253707841000, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      -0.3824893226812950, 0.5052296174685460, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.42272197080185700, 0.2272937779059940, -0.37035036364826500, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.4227214257695730, 0.22729366889953700, 0.19281449057712800, 1.0, r1, b1, g1,
      -0.2611367945463200, -0.05064461785797190, 0.390289388706506, 1.0, r1, b1, g1,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      -0.2611367945463200, -0.05064461785797190, 0.390289388706506, 1.0, r1, b1, g1,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      0.06617820146649640, -0.09944206680166400, 0.6484295412512320, 1.0, r2, b2, g2,
      0.44927442304653800, -0.05064450885151510, 0.6863703286168600, 1.0, r2, b2, g2,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      0.44927442304653800, -0.05064450885151510, 0.6863703286168600, 1.0, r2, b2, g2,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      0.3683354337969180, -0.30137053273145100, 0.3668432989125460, 1.0, r2, b2, g2,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.7418239298277480, -0.09944043170481140, 0.36684498851262700, 1.0, r3, b3, g3,
      0.8883376553485080, -0.050641838193322700, -0.08876815454848250, 1.0, r3, b3, g3,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.8883376553485080, -0.050641838193322700, -0.08876815454848250, 1.0, r3, b3, g3,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.6264106184933700, -0.30136944266688200, -0.08876815454848250, 1.0, r3, b3, g3,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      0.7418237663180620, -0.09944043170481140, -0.5443813521128210, 1.0, r3, b3, g3,
      0.44927406877555300, -0.05064434534182980, -0.8639065287073680, 1.0, r2, b2, g2,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.2611367945463200, -0.05064461785797190, 0.390289388706506, 1.0, r1, b1, g1,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      -0.3513886904819980, -0.09944097673709560, -0.08876815454848250, 1.0, r1, b1, g1,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      -0.04923156715803330, -0.30137053273145100, 0.1928126919705900, 1.0, r1, b1, g1,
      0.2529241935852210, -0.39418626053186300, -0.08876815454848250, 1.0, r2, b2, g2,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      0.44927406877555300, -0.05064434534182980, -0.8639065287073680, 1.0, r2, b2, g2,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      0.3683352157840040, -0.30137053273145100, -0.5443797170159680, 1.0, r2, b2, g2,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      -0.04923167616449010, -0.30137053273145100, -0.37034872855141300, 1.0, r1, b1, g1,
      0.06617787444712600, -0.09944206680166400, -0.8259657413417400, 1.0, r2, b2, g2,
      -0.26113733957860400, -0.050644563354743500, -0.5678253707841000, 1.0, r1, b1, g1,
  ])
    var nn = 240;		// 12 tetrahedron vertices; 36 cube verts (6 per side*6 sides)
	
  // Create a buffer object
  var shapeBufferHandle = gl.createBuffer();  
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);

  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?
  
  // Connect a VBO Attribute to Shaders------------------------------------------
  //Get GPU's handle for our Vertex Shader's position-input variable: 
  var a_PositionLoc = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_PositionLoc < 0) {
    console.log('Failed to get attribute storage location of a_Position');
    return -1;
  }
  // Use handle to specify how to Vertex Shader retrieves position data from VBO:
  gl.vertexAttribPointer(
  		a_PositionLoc, 	// choose Vertex Shader attribute to fill with data
  		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
  		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
  		false, 				// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * 7, 		// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		0);						// Offset -- now many bytes from START of buffer to the
  									// value we will actually use?
  gl.enableVertexAttribArray(a_PositionLoc);  
  									// Enable assignment of vertex buffer object's position data
//-----------done.
// Connect a VBO Attribute to Shaders-------------------------------------------
  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_ColorLoc = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_ColorLoc < 0) {
    console.log('Failed to get the attribute storage location of a_Color');
    return -1;
  }
  // Use handle to specify how Vertex Shader retrieves color data from our VBO:
  gl.vertexAttribPointer(
  	a_ColorLoc, 				// choose Vertex Shader attribute to fill with data
  	3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
  	gl.FLOAT, 			// data type for each value: usually gl.FLOAT
  	false, 					// did we supply fixed-point data AND it needs normalizing?
  	FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  	FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
  									// value we will actually use?  Need to skip over x,y,z,w 									
  gl.enableVertexAttribArray(a_ColorLoc);  
  									// Enable assignment of vertex buffer object's position data
//-----------done.
  // UNBIND the buffer object: we have filled the VBO & connected its attributes
  // to our shader, so no more modifications needed.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
}

function draw() {
//==============================================================================
  // Clear <canvas>  colors AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  modelMatrix.setIdentity();

    //====================================
    //HEAD
    //====================================

    pushMatrix(modelMatrix);
    drawHead();

    //====================================
    //BODY
    //====================================

    pushMatrix(modelMatrix);

    drawBody();

    //====================================
    //legs1
    //====================================

    pushMatrix(modelMatrix);

    drawLegOne();

    //====================================
    //legs2
    //====================================
    modelMatrix = popMatrix();

    drawLegTwo();

    //====================================
    //Feet1
    //====================================
    modelMatrix = popMatrix();
    

    drawFeetOne();
    

    //====================================
    //Feet2
    //====================================

    drawFeetTwo();

    

    
    
    
    // ==================================
    // FIRST WING
    //==================================

    drawWings();


    
    

    modelMatrix.translate(0.1, 0.5, 0.0);

    
    

    modelMatrix = popMatrix();


    //============ EGG ======//

    drawEgg();
    


    //========== NEST1 =============
    pushMatrix(modelMatrix);
    drawNestOne();
    

    //========== NEST2 =============

    pushMatrix(modelMatrix);

    drawNestTwo();

    

    //========== NEST3 =============

    pushMatrix(modelMatrix);

    drawNestThree();

    modelMatrix = popMatrix();
        
    modelMatrix = popMatrix();
    
    modelMatrix = popMatrix();

}


function drawHead() {
    modelMatrix.translate(0.0, 0.0, 0.3);  // 'set' means DISCARD old matrix,
    
    modelMatrix.scale(0.18, 0.2, 0.18);
    // if you DON'T scale, tetra goes outside the CVV; clipped!
    modelMatrix.rotate(-150, 0, 1, 0);  // Make new drawing axes that
    
    modelMatrix.translate(0.8, 0.0, 0.0);
    modelMatrix.translate(0, 2, 0);

    modelMatrix.rotate(g_angle1now, 0, 1, 0);

    modelMatrix.translate(2.3, 0, 0);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
    // Draw just the first set of vertices: start at vertex 0...
    gl.drawArrays(gl.TRIANGLES, 0, g_nVerts);
 //gl.drawArrays(gl.LINE_LOOP, 0, 12);   // TRY THIS INSTEAD of gl.TRIANGLES...

}

function drawBody() {
    modelMatrix.translate(-0.3, -4.0, -0.5);  // 'set' means DISCARD old matrix,
    modelMatrix.scale(1.5, 1.5, 0.7);
    // if you DON'T scale, tetra goes outside the CVV; clipped!
    //modelMatrix.rotate(0, currentAngle, 1, 0);  // Make new drawing axes that

    modelMatrix.translate(0, 2, 0);

    //modelMatrix.rotate(0, 0, 0.5, 0);
    modelMatrix.rotate(g_angle2now, 0, 1, 0);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
    // Draw just the first set of vertices: start at vertex 0...
    gl.drawArrays(gl.TRIANGLES, 0, 240);

}

function drawLegOne() {

    modelMatrix.translate(0.5, -1, 0.7);

    modelMatrix.translate(-0.8, 0.5, -0.7);  // 'set' means DISCARD old matrix,

    modelMatrix.scale(0.2, 0.9, 0.2);

    modelMatrix.rotate(0, 0, 50, 1);

    modelMatrix.rotate(g_angle2now, g_angle1now, 0, 1);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
    // Draw just the first set of vertices: start at vertex 0...
    gl.drawArrays(gl.TRIANGLES, 0, 240);

}

function drawLegTwo() {

    modelMatrix.translate(0.0, -1, -0.9);

    modelMatrix.translate(0.3, 0.5, 0.2);

    modelMatrix.scale(0.2, 0.9, 0.2);

    modelMatrix.rotate(g_angle2now, g_angle1now, 0, 1);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 240);

}

function drawFeetOne() {

    
    
    modelMatrix.translate(0.5, -2.4, -0.1);
    modelMatrix.scale(0.7, 0.3, 1);
    

    modelMatrix.rotate(g_angle2now, 1, 0, 0);
    //modelMatrix.translate(0.5, -2.4, 0.0);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 240);
    
    
    

    

    /// SECOND FEET

    
    

}

function drawFeetTwo() {

    //modelMatrix.rotate(5.0, 0.0, 1.0, 1.5);
    //modelMatrix.translate(-0.0, -0.7, 0.0);
    //modelMatrix.rotate(180.0, 0.0, 0.0, 1.5);
    
    modelMatrix.translate(-1.5, -0.0, -0.0);


    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 240);
    


    
    
    


}

function drawWings() {

    modelMatrix.translate(8, 1.5, -3);



    modelMatrix.scale(3, 1, 0.5);
    modelMatrix.translate(-0.5, -0.5, 5);



    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    //gl.drawArrays(gl.LINE_LOOP, 0, 240);

    // ==================================
    // SECOND WING
    //==================================

    modelMatrix.translate(0.0, -1, -0.9);

    modelMatrix.translate(-0.1, 0.5, 0.2);

    modelMatrix.scale(0.2, 0.9, 0.2);



    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    //gl.drawArrays(gl.LINE_LOOP, 0, 240);
}

function drawEgg() {

    modelMatrix.translate(-0.1, -0.7, -1);



    modelMatrix.scale(0.2, 0.3, 0.2);
    modelMatrix.scale(0.6, 0.6, 0.6);

    modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);

    

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 240);


}


function drawNestOne() {

    modelMatrix.translate(-0.8, -0.2, 3);



    modelMatrix.scale(4, 0.3, 0.2);
    modelMatrix.translate(0.0, -0.6, 0.0);

    // modelMatrix.rotate(60, 0, 1, 0);
    //modelMatrix.rotate(0.5, 0, 1, 0);

    

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 150);
}


function drawNestTwo() {

    modelMatrix.translate(0, -0.2, 3);


    //modelMatrix.rotate(currentAngleNest, 0, 1, 0);
    modelMatrix.scale(1.7, 1.5, 0.2);
    modelMatrix.translate(-0.05, -0.6, 0.0);


    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.LINE_LOOP, 0, 240);


}

function drawNestThree() {

    modelMatrix.translate(0, -0.2, 3);



    modelMatrix.scale(1.3, 3, 0.2);
    modelMatrix.translate(-0.08, 0.3, 0.0);

    gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);

    gl.drawArrays(gl.TRIANGLES, 0, 30);
}




// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();






//==================HTML Button Callbacks
function spinUp() {
    g_angle1now += 45; 
}

function spinDown() {
    g_angle1now -= 45; 
}

function startAgain() {
    if (g_angle1now * g_angle1now > 1) {
        myTmp = g_angle1now;
        g_angle1now = 0;
        initVertexBuffer();
  }
  else {
        g_angle1now = myTmp;
  }
}



//=====================KEYBOARD Functions ======================


function myMouseDown(ev) {
    //==============================================================================
    // Called when user PRESSES down any mouse button;
    // 									(Which button?    console.log('ev.button='+ev.button);   )
    // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
    //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

    // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;

    var g_canvas = document.getElementById('HTML5_canvas');

    var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
    var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
    var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
    //  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);

    // Convert to Canonical View Volume (CVV) coordinates too:
    var x = (xp - g_canvas.width / 2) / 		// move origin to center of canvas and
        (g_canvas.width / 2);			// normalize canvas to -1 <= x < +1,
    var y = (yp - g_canvas.height / 2) /		//										 -1 <= y < +1.
        (g_canvas.height / 2);
    //	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);

    g_isDrag = true;											// set our mouse-dragging flag
    g_xMclik = x;													// record where mouse-dragging began
    g_yMclik = y;
    // report on webpage



};


function myMouseMove(ev) {
    //==============================================================================
    // Called when user MOVES the mouse with a button already pressed down.
    // 									(Which button?   console.log('ev.button='+ev.button);    )
    // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
    //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)

    var g_canvas = document.getElementById('HTML5_canvas');

    if (g_isDrag == false) return;				// IGNORE all mouse-moves except 'dragging'

    // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
    var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
    var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
    var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
    //  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);

    // Convert to Canonical View Volume (CVV) coordinates too:
    var x = (xp - g_canvas.width / 2) / 		// move origin to center of canvas and
        (g_canvas.width / 2);		// normalize canvas to -1 <= x < +1,
    var y = (yp - g_canvas.height / 2) /		//										-1 <= y < +1.
        (g_canvas.height / 2);

    //	console.log('myMouseMove(CVV coords  ):  x, y=\t',x,',\t',y);

    // find how far we dragged the mouse:
    g_xMdragTot += (x - g_xMclik);			// Accumulate change-in-mouse-position,&
    g_yMdragTot += (y - g_yMclik);
    // Report new mouse position & how far we moved on webpage:



    g_xMclik = x;											// Make next drag-measurement from here.
    g_yMclik = y;
};

function myMouseUp(ev) {
    //==============================================================================
    // Called when user RELEASES mouse button pressed previously.
    // 									(Which button?   console.log('ev.button='+ev.button);    )
    // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
    //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

    var g_canvas = document.getElementById('HTML5_canvas');
    // Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
    var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
    var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
    var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
    //  console.log('myMouseUp  (pixel coords):\n\t xp,yp=\t',xp,',\t',yp);

    // Convert to Canonical View Volume (CVV) coordinates too:
    var x = (xp - g_canvas.width / 2) / 		// move origin to center of canvas and
        (g_canvas.width / 2);			// normalize canvas to -1 <= x < +1,
    var y = (yp - g_canvas.height / 2) /		//										 -1 <= y < +1.
        (g_canvas.height / 2);
    console.log('myMouseUp  (CVV coords  ):\n\t x, y=\t', x, ',\t', y);

    g_isDrag = false;											// CLEAR our mouse-dragging flag, and
    // accumulate any final bit of mouse-dragging we did:
    g_xMdragTot += (x - g_xMclik);
    g_yMdragTot += (y - g_yMclik);
    // Report new mouse position:

    console.log('myMouseUp: g_xMdragTot,g_yMdragTot =',
        g_xMdragTot.toFixed(g_digits), ',\t', g_yMdragTot.toFixed(g_digits));
};

function myMouseClick(ev) {
    //=============================================================================
    // Called when user completes a mouse-button single-click event 
    // (e.g. mouse-button pressed down, then released)
    // 									   
    //    WHICH button? try:  console.log('ev.button='+ev.button); 
    // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
    //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!) 
    //    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.

    // STUB
    console.log("myMouseClick() on button: ", ev.button);
}

function myMouseDblClick(ev) {
    //=============================================================================
    // Called when user completes a mouse-button double-click event 
    // 									   
    //    WHICH button? try:  console.log('ev.button='+ev.button); 
    // 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
    //		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!) 
    //    See myMouseUp(), myMouseDown() for conversions to  CVV coordinates.

    // STUB
    console.log("myMouse-DOUBLE-Click() on button: ", ev.button);
}

function myKeyDown(kev) {
    //===============================================================================
    // Called when user presses down ANY key on the keyboard;
    //
    // For a light, easy explanation of keyboard events in JavaScript,
    // see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
    // For a thorough explanation of a mess of JavaScript keyboard event handling,
    // see:    http://javascript.info/tutorial/keyboard-events
    //
    // NOTE: Mozilla deprecated the 'keypress' event entirely, and in the
    //        'keydown' event deprecated several read-only properties I used
    //        previously, including kev.charCode, kev.keyCode. 
    //        Revised 2/2019:  use kev.key and kev.code instead.
    //
    // Report EVERYTHING in console:
    




    switch (kev.code) {
        case "KeyP":
            console.log("Pause/unPause!\n");                // print on console,
            document.getElementById('KeyDownResult').innerHTML =
                'myKeyDown() found p/P key. Pause/unPause!';   // print on webpage

            break;
        //------------------WASD navigation-----------------
        case "KeyA":
            r1 = 0.7;
            console.log(r1);
            initVertexBuffer();
            break;
        case "KeyD":
            b1 = 0.7;
            console.log(r1);
            initVertexBuffer();
            break;
        case "KeyB":
            broaden -= 0.01;
            initVertexBuffer();
            break;


        //----------------Arrow keys------------------------
        case "ArrowLeft":
            console.log(' left-arrow.');
            r1 += 0.25;
            initVertexBuffer();
            break;
        case "ArrowRight":
            b1 += 0.25;
            initVertexBuffer();
            break;
        case "ArrowUp":
            b2 += 0.25;
            initVertexBuffer();
            break;
        case "ArrowDown":
            r2 += 0.25;
            initVertexBuffer();
            break;
        default:
            console.log("UNUSED!");

            break;
    }
}

function myKeyUp(kev) {
    //===============================================================================
    // Called when user releases ANY key on the keyboard; captures scancodes well

    console.log('myKeyUp()--keyCode=' + kev.keyCode + ' released.');
}


var slider = document.getElementById("myRange");

slider.oninput = function () {
    r1 = this.value;
    
    b1 = this.value;
    b2 = this.value;
    
    g2 = this.value;

    
    initVertexBuffer();
    console.log(slider.value);
    
}


