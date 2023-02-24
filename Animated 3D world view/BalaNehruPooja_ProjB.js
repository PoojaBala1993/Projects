//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// BasicShapes.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//		--converted from 2D to 4D (x,y,z,w) vertices
//		--extend to other attributes: color, surface normal, etc.
//		--demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//		--create several canonical 3D shapes borrowed from 'GLUT' library:
//		--Demonstrate how to make a 'stepped spiral' tri-strip,  and use it
//			to build a cylinder, sphere, and torus.
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

// Global Variables
var canvas;
var gl;
var ANGLE_STEP = 45.0;		// Rotation angle rate (degrees/second)
var floatsPerVertex = 7;
var n;
var chickenShapes;
var g_canvas = document.getElementById('webgl');
var g_near;
var g_far;

var eye_x;
var eye_y;
var eye_z;



var g_lastMS = Date.now();

var u_ModelMatrix;
var modelMatrix;
var projMatrix;
var viewMatrix;
var mvpMatrix;

//------------For mouse click-and-drag: -------------------------------
var g_isDrag = false;		// mouse-drag: true when user holds down mouse button
var g_xMclik = 0.0;			// last mouse button-down position (in CVV coords)
var g_yMclik = 0.0;
var g_xMdragTot = 0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var g_yMdragTot = 0.0;
var g_digits = 5;			// DIAGNOSTICS: # of digits to print in console.log (

var isDrag = false;		// mouse-drag: true when user holds down mouse button
var xMclik = 0.0;			// last mouse button-down position (in CVV coords)
var yMclik = 0.0;
var xMdragTot = 0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot = 0.0;

var qNew = new Quaternion(0, 0, 0, 1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0, 0, 0, 1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();

//------------Angle rotation -------------------------------
//------------------------------------------------


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

var g_angle3now = 10.0; 			// init Current rotation angle, in degrees.
var g_angle3rate = 81.0;				// init Rotation angle rate, in degrees/second.
var g_angle3brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle3min = -40.0;       // init min, max allowed angle, in degrees
var g_angle3max = 40.0;

var g_angle4now = 0.0; 			// init Current rotation angle, in degrees.
var g_angle4rate = 10.0;				// init Rotation angle rate, in degrees/second.
var g_angle4brake = 1.0;				// init Speed control; 0=stop, 1=full speed.
var g_angle4min = -40.0;       // init min, max allowed angle, in degrees
var g_angle4max = 40.0;



function main() {
	//==============================================================================

	// Get the rendering context for WebGL
	gl = getWebGLContext(g_canvas);
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	var nf = document.getElementById('nearFar');

	// Initialize shaders
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to intialize shaders.');
		return;
	}

	// 
	n = initVertexBuffer(gl);
	if (n < 0) {
		console.log('Failed to set the vertex information');
		return;
	}


	g_canvas.onmousedown = function (ev) { myMouseDown(ev, gl, g_canvas) };
	g_canvas.onmousemove = function (ev) { myMouseMove(ev, gl, g_canvas) };
	g_canvas.onmouseup = function (ev) { myMouseUp(ev, gl, g_canvas) };



	// Specify the color for clearing <canvas>
	gl.clearColor(0.0, 0.0, 0.2, 1.0);

	// NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
	//	gl.depthFunc(gl.LESS);			 // WebGL default setting: (default)
	gl.enable(gl.DEPTH_TEST);


	// Get handle to graphics system's storage location of u_ModelMatrix
	u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if (!u_ModelMatrix) {
		console.log('Failed to get the storage location of u_ModelMatrix');
		return;
	}
	//   var u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
	//   if (!u_MvpMatrix) { 
	//     console.log('Failed to get the storage location of u_MvpMatrix');
	//     return;
	//   }



	// Create a local version of our model matrix in JavaScript 
	modelMatrix = new Matrix4();
	viewMatrix = new Matrix4();  // View matrix
	projMatrix = new Matrix4();  // Projection matrix
	mvpMatrix = new Matrix4();   // Model view projection matrix

	// Create, init current rotation angle value in JavaScript


	//-----------------  
	// Start drawing: create 'tick' variable whose value is this function:
	var tick = function () {

		requestAnimationFrame(tick, canvas);
		timerAll();
		drawAll();
		// Request that the browser re-draw the webpage
	};
	tick();							// start (and continue) animation: draw current image

	drawResize();

	document.onkeydown = function (ev) { keydown(ev); };
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

function initVertexBuffer(gl) {


	chickenShapes = new Float32Array([
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

		// Drawing Axes: Draw them using gl.LINES drawing primitive;

		0.0, 0.0, 0.0, 1.0, 1.0, 0.3, 0.3,	// X axis line (origin: gray)
		2.3, 0.0, 0.0, 1.0, 1.0, 0.3, 0.3,	// 						 (endpoint: red)

		0.0, 0.0, 0.0, 1.0, 0.3, 1.0, 0.3,	// Y axis line (origin: white)
		0.0, 2.3, 0.0, 1.0, 0.3, 1.0, 0.3,	//						 (endpoint: green)

		0.0, 0.0, 0.0, 1.0, 0.3, 0.3, 1.0,	// Z axis line (origin:white)
		0.0, 0.0, 2.3, 1.0, 0.3, 0.3, 1.0,
	])

	//   makeCylinder();					
	makeGroundGrid();				// create, fill the gndVerts array
	// how many floats total needed to store all shapes?
	var mySiz = (chickenShapes.length + gndVerts.length);

	var nn = mySiz / floatsPerVertex;
	console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex, 'chickenShapes length is', chickenShapes.length, 'chickenShapes vertices are', (chickenShapes.length / floatsPerVertex));

	// Copy all shapes into one big Float32 array:
	var colorShapes = new Float32Array(mySiz);
	// Copy them:  remember where to start for each shape:
	chickenStart = 0;							// we stored the cylinder first.
	for (i = 0, j = 0; j < chickenShapes.length; i++, j++) {
		colorShapes[i] = chickenShapes[j];
	}


	gndStart = i;						// next we'll store the ground-plane;
	for (j = 0; j < gndVerts.length; i++, j++) {
		colorShapes[i] = gndVerts[j];
	}




	//===================================================		
	// Create a buffer object on the graphics hardware:
	var shapeBufferHandle = gl.createBuffer();
	if (!shapeBufferHandle) {
		console.log('Failed to create the shape buffer object');
		return false;
	}


	gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);

	gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);
	var FSIZE = colorShapes.BYTES_PER_ELEMENT;


	var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if (a_Position < 0) {
		console.log('Failed to get the storage location of a_Position');
		return -1;
	}


	gl.vertexAttribPointer(
		a_Position, 	// choose Vertex Shader attribute to fill with data
		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
		false, 				// did we supply fixed-point data AND it needs normalizing?
		FSIZE * floatsPerVertex, // Stride -- how many bytes used to store each vertex?
		// (x,y,z,w, r,g,b) * bytes/value
		0);						// Offset -- now many bytes from START of buffer to the
	// value we will actually use?
	gl.enableVertexAttribArray(a_Position);
	// Enable assignment of vertex buffer object's position data

	// Get graphics system's handle for our Vertex Shader's color-input variable;
	var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if (a_Color < 0) {
		console.log('Failed to get the storage location of a_Color');
		return -1;
	}
	// Use handle to specify how to retrieve **COLOR** data from our VBO:
	gl.vertexAttribPointer(
		a_Color, 				// choose Vertex Shader attribute to fill with data
		3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
		gl.FLOAT, 			// data type for each value: usually gl.FLOAT
		false, 					// did we supply fixed-point data AND it needs normalizing?
		FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
		// (x,y,z,w, r,g,b) * bytes/value
		FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
	// value we will actually use?  Need to skip over x,y,z,w

	gl.enableVertexAttribArray(a_Color);
	// Enable assignment of vertex buffer object's position data

	//--------------------------------DONE!
	// Unbind the buffer object 
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	return nn;
}



function makeGroundGrid() {
	//==============================================================================
	// Create a list of vertices that create a large grid of lines in the x,y plane
	// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 150;			// # of lines to draw in x,y to make the grid.
	var ycount = 150;
	var xymax = 50.0;			// grid size; extends to cover +/-xymax in x and y.ß
	var xColr = new Float32Array([0.4, 0.0, 0.7]);	// blue
	var yColr = new Float32Array([0.7, 0.0, 0.1]);	// maroon

	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex * 2 * (xcount + ycount));
	// draw a grid made of xcount+ycount lines; 2 vertices per line.

	var xgap = xymax / (xcount - 1);		// HALF-spacing between lines in x,y;
	var ygap = xymax / (ycount - 1);		// (why half? because v==(0line number/2))

	// First, step thru x values as we make vertical lines of constant-x:
	for (v = 0, j = 0; v < 2 * xcount; v++, j += floatsPerVertex) {
		if (v % 2 == 0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j] = -xymax + (v) * xgap;	// x
			gndVerts[j + 1] = -xymax;								// y
			gndVerts[j + 2] = 0.0;									// z
			gndVerts[j + 3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j] = -xymax + (v - 1) * xgap;	// x
			gndVerts[j + 1] = xymax;								// y
			gndVerts[j + 2] = 0.0;									// z
			gndVerts[j + 3] = 1.0;									// w.
		}
		gndVerts[j + 4] = xColr[0];			// red
		gndVerts[j + 5] = xColr[1];			// grn
		gndVerts[j + 6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for (v = 0; v < 2 * ycount; v++, j += floatsPerVertex) {
		if (v % 2 == 0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j] = -xymax;								// x
			gndVerts[j + 1] = -xymax + (v) * ygap;	// y
			gndVerts[j + 2] = 0.0;									// z
			gndVerts[j + 3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j] = xymax;								// x
			gndVerts[j + 1] = -xymax + (v - 1) * ygap;	// y
			gndVerts[j + 2] = 0.0;									// z
			gndVerts[j + 3] = 1.0;									// w.
		}
		gndVerts[j + 4] = yColr[0];			// red
		gndVerts[j + 5] = yColr[1];			// grn
		gndVerts[j + 6] = yColr[2];			// blu
	}
}

function toRadians(degrees) {
	var pi = Math.PI;
	return degrees * (pi / 180);
}

function toDegrees(radians) {
	var pi = Math.PI;
	return radians * (180 / pi);
}




g_near = 0.3;
g_far = 200.0;
var leftw, rightw, bottomh, toph;



eye_x = 2.0, eye_y = 1.0, eye_z = 0.5;
var g_theta = 0.01;
var g_delta = 0.05;


function keydown(ev) {
	switch (ev.keyCode) {
		case 79: {		// letter 'o' --> move forward 
			//works
			eye_x += Math.cos(g_theta);
			eye_y += Math.sin(g_theta);
			eye_z += g_delta;
			console.log('forward coords', eye_x, eye_y, eye_x + Math.cos(g_theta), eye_y + Math.sin(g_theta));
		}
			break;

		case 76: {		//letter 'l' --> move backward
			//works
			eye_x -= Math.cos(g_theta);
			eye_y -= Math.sin(g_theta);
			eye_z -= g_delta;
			console.log('back coords', eye_x, eye_y, eye_x + Math.cos(g_theta), eye_y + Math.sin(g_theta));
		}

			break;

		case 37: {		//left arrow --> Strafe left
			//works
			eye_x += -Math.sin(g_theta);
			eye_y += Math.cos(g_theta);
		}

			break;
		case 39: {		//right arrow --> Strafe right
			//works
			eye_x -= -Math.sin(g_theta);
			eye_y -= Math.cos(g_theta);
		}
			break;

		//works

		case 65: {		//letter 'a';
			g_theta += 0.03;
		}
			break;

		case 68: {		//letter 'd';
			g_theta -= 0.03;
		}
			break;

		case 87: {		//letter 'w';
			g_delta += 0.03;
		}
			break;

		case 83: {		//letter 's';
			g_delta -= 0.03;
		}
			break;

	}
}


function drawAll() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.viewport(0, 0, g_canvas.width / 2, g_canvas.height);
	modelMatrix.setIdentity();

	var vpAspect = (g_canvas.width / 2) / (g_canvas.height);


	modelMatrix.perspective(35.0, vpAspect, g_near, g_far);
	modelMatrix.lookAt(eye_x, eye_y, eye_z,
		eye_x + Math.cos(g_theta), eye_y + Math.sin(g_theta), eye_z + g_delta,
		0, 0, 1);


	drawTheChickens();


	gl.viewport(g_canvas.width / 2, 0, g_canvas.width / 2, g_canvas.height);
	modelMatrix.setIdentity();



	leftw = -g_canvas.width / 200, rightw = g_canvas.width / 200, bottomh = -g_canvas.height / 100, toph = g_canvas.height / 100;

	modelMatrix.ortho(leftw, rightw, bottomh, toph, g_near, g_far);
	modelMatrix.lookAt(eye_x, eye_y, eye_z,
		eye_x + Math.cos(g_theta), eye_y + Math.sin(g_theta), eye_z + g_delta,
		0, 0, 1);
	drawTheChickens();


}

function drawTheChickens() {

	//===========================================================
	// DRAW THE GROUND GRID
	//===========================================================
	pushMatrix(modelMatrix);
	drawGG(gl, modelMatrix, u_ModelMatrix);
	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	gl.drawArrays(gl.LINES, 240, 6);
	//===========================================================
	// DRAW chicken head
	//===========================================================
	pushMatrix(modelMatrix);
	drawHead(gl, modelMatrix, u_ModelMatrix);
	//====================================
	//BODY
	//====================================

	pushMatrix(modelMatrix);

	drawBody(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//legs1
	//====================================

	pushMatrix(modelMatrix);

	drawLegOne(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//legs2
	//====================================
	modelMatrix = popMatrix();

	drawLegTwo(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//Feet1
	//====================================
	modelMatrix = popMatrix();


	drawFeetOne(gl, modelMatrix, u_ModelMatrix);

	drawFeetTwo(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//Feet Webs 1
	//====================================
	pushMatrix(modelMatrix);

	drawFeetWebOne(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//Feet Webs 2
	//====================================

	drawFeetWebTwo(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//Feet Webs 3
	//====================================

	drawFeetWebThree(gl, modelMatrix, u_ModelMatrix);

	//====================================
	//Feet Webs 4
	//====================================

	drawFeetWebFour(gl, modelMatrix, u_ModelMatrix);

	modelMatrix = popMatrix();

	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.





	//====================================
	//EGG >> 1
	//====================================
	pushMatrix(modelMatrix);
	drawEgg(gl, modelMatrix, u_ModelMatrix);



	//========== NEST1 =============
	pushMatrix(modelMatrix);
	drawNestOne(gl, modelMatrix, u_ModelMatrix);


	//========== NEST2 =============

	pushMatrix(modelMatrix);

	drawNestTwo(gl, modelMatrix, u_ModelMatrix);



	//========== NEST3 =============

	pushMatrix(modelMatrix);

	drawNestThree(gl, modelMatrix, u_ModelMatrix);

	modelMatrix = popMatrix();
	modelMatrix = popMatrix();
	modelMatrix = popMatrix();
	modelMatrix = popMatrix();







	//====================================
	//Chicken Fence
	//====================================
	pushMatrix(modelMatrix);
	drawfence1(gl, modelMatrix, u_ModelMatrix);
	drawfence2(gl, modelMatrix, u_ModelMatrix);
	drawfence3(gl, modelMatrix, u_ModelMatrix);
	drawfence4(gl, modelMatrix, u_ModelMatrix);
	drawfence5(gl, modelMatrix, u_ModelMatrix);
	drawfence6(gl, modelMatrix, u_ModelMatrix);
	drawfence7(gl, modelMatrix, u_ModelMatrix);
	modelMatrix = popMatrix();


	//// THIRD ASEEMBLY BRANCH ============

	pushMatrix(modelMatrix);

	drawBranchOne(gl, n, modelMatrix, u_ModelMatrix);
	drawBranchTwo(gl, n, modelMatrix, u_ModelMatrix);
	drawBranchThree(gl, n, modelMatrix, u_ModelMatrix);
	drawBranchFour(gl, n, modelMatrix, u_ModelMatrix);

	drawBushOne(gl, n, modelMatrix, u_ModelMatrix);
	drawBushTwo(gl, n, modelMatrix, u_ModelMatrix);
	drawBushThree(gl, n, modelMatrix, u_ModelMatrix);


	modelMatrix = popMatrix();



}




function drawGG(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(0.4, -0.4, 0.0);
	modelMatrix.scale(0.1, 0.1, 0.1);				// shrink by 10X:

	// Drawing:
	// Pass our current matrix to the vertex shaders:
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	// Draw just the ground-plane's vertices
	gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
		gndStart / floatsPerVertex,	// start at this vertex number, and
		gndVerts.length / floatsPerVertex);	// draw this many vertices.

}



function drawHead(gl, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(0.0, 1.0, 0.2);  // 'set' means DISCARD old matrix,

	modelMatrix.scale(0.18, 0.2, 0.18);
	modelMatrix.scale(1.0, 1.0, 1.0);

	modelMatrix.rotate(111, 1, 1, 1);

	modelMatrix.translate(0.8, 0.0, 0.0);
	modelMatrix.translate(0, 2, 0);

	modelMatrix.rotate(g_angle1now, 0, 1, 0);

	modelMatrix.translate(2.3, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawBody(gl, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(-0.3, -4.0, -0.5);  // 'set' means DISCARD old matrix,
	modelMatrix.scale(1.5, 1.5, 0.7);
	// if you DON'T scale, tetra goes outside the CVV; clipped!


	modelMatrix.translate(0, 2, 0);

	//modelMatrix.rotate(0, 0, 0.5, 0);
	modelMatrix.rotate(g_angle2now, 0, 1, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawLegOne(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(0.5, -1.2, 0.7);

	modelMatrix.translate(-0.8, 0.5, -0.7);  // 'set' means DISCARD old matrix,

	modelMatrix.scale(0.2, 0.9, 0.2);

	modelMatrix.rotate(0, 0, 50, 1);

	modelMatrix.rotate(g_angle2now, g_angle1now, 0, 1);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawLegTwo(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(0.0, -1.2, -0.9);

	modelMatrix.translate(0.3, 0.5, 0.2);

	modelMatrix.scale(0.2, 0.9, 0.2);

	modelMatrix.rotate(g_angle2now, g_angle1now, 0, 1);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawFeetOne(gl, modelMatrix, u_ModelMatrix) {



	modelMatrix.translate(0.5, -2.6, -0.1);
	modelMatrix.scale(0.7, 0.3, 1);


	modelMatrix.rotate(g_angle2now, 1, 0, 0);
	//modelMatrix.translate(0.5, -2.4, 0.0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawFeetTwo(gl, modelMatrix, u_ModelMatrix) {

	//modelMatrix.rotate(5.0, 0.0, 1.0, 1.5);
	//modelMatrix.translate(-0.0, -0.7, 0.0);
	//modelMatrix.rotate(180.0, 0.0, 0.0, 1.5);

	modelMatrix.translate(-1.5, -0.3, -0.0);


	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);
}

function drawFeetWebOne(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(-0.0, -0.0, 0.8);
	modelMatrix.scale(0.5, 0.5, 0.5);
	modelMatrix.rotate(g_angle1now, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);




}
function drawFeetWebTwo(gl, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(1.2, -0.0, -0.0);
	modelMatrix.scale(1, 1, 1);
	modelMatrix.rotate(g_angle1now, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawFeetWebThree(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.3, -0.0, -0.2);
	modelMatrix.scale(1, 1, 1);
	modelMatrix.rotate(g_angle1now, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}
function drawFeetWebFour(gl, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(1.2, -0.0, -0.0);
	modelMatrix.scale(1, 1, 1);
	modelMatrix.rotate(g_angle1now, 1, 0, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}



function drawEgg(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(0.0, -1.0, 0.27);

	modelMatrix.rotate(180, 1, 0.0, 0.0);


	modelMatrix.scale(0.2, 0.3, 0.2);
	modelMatrix.scale(0.6, 0.6, 0.6);
	modelMatrix.translate(-15.0, 0.0, 1);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}


function drawNestOne(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(-0.0, 0.0, 0.5);
	modelMatrix.scale(3, 0.3, 0.2);
	modelMatrix.translate(0.0, -0.6, 0.0);

	// modelMatrix.rotate(60, 0, 1, 0);
	//modelMatrix.rotate(0.5, 0, 1, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);
}


function drawNestTwo(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(-0.4, -0.2, 3);



	modelMatrix.scale(1.7, 1.5, 0.2);
	modelMatrix.translate(-0.05, -0.6, 0.0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawNestThree(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(0, -0.2, 3);



	modelMatrix.scale(1.3, 3, 0.2);
	modelMatrix.translate(-0.08, 0.3, 0.0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);
}





function drawfence1(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(-2.0, -3.0, 0.25);


	modelMatrix.scale(0.1, 0.4, 0.5);
	modelMatrix.scale(5, 0.3, 0.5);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence2(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.0, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence3(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.2, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence4(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.2, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence5(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.2, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence6(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.2, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}

function drawfence7(gl, modelMatrix, u_ModelMatrix) {

	modelMatrix.translate(1.2, 0.0, 0.0);


	modelMatrix.scale(1, 1, 1);

	modelMatrix.translate(g_xMdragTot, g_yMdragTot, 0.0, 0.0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);


}


function drawBranchOne(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(5, 0.0, 0.1);
	modelMatrix.rotate(-180, 0, 1, 1);

	modelMatrix.scale(0.2, 3, 0.5);
	modelMatrix.scale(0.1, 0.1, 0.1);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawBranchTwo(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(0, 1, 0);


	modelMatrix.scale(1, 0.8, 1);
	modelMatrix.rotate(150, 0, 1, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawBranchThree(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(0, 1, 0);


	modelMatrix.scale(4, 0.3, 0.5);
	modelMatrix.rotate(150, 0, 0, 1);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawBranchFour(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(-0.5, 0, 0);


	modelMatrix.scale(1, 2, 1);
	modelMatrix.rotate(150, 0, 1, 0);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawBushOne(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(5, 3.0, 17);
	modelMatrix.rotate(180, 0, 1, 0);

	modelMatrix.scale(15, 7.5, 4);

	modelMatrix.scale(0.2, 0.2, 0.2);

	quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
	modelMatrix.concat(quatMatrix);	// apply that matrix.

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

	gl.drawArrays(gl.LINES, 240, 6);

}



function drawBushTwo(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(0.1, 1, 0);

	modelMatrix.scale(1, 0.8, 2);

	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}

function drawBushThree(gl, n, modelMatrix, u_ModelMatrix) {
	modelMatrix.translate(0, 0, 0);
	modelMatrix.rotate(180, 0, 1, 0);

	modelMatrix.scale(1, 1.5, 0);



	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, 0, 	// start at this vertex number, and
		240);

}


function drawResize() {

	//Make canvas fill the top 3/4 of our browser window:
	var xtraMargin = 1;    // keep a margin (otherwise, browser adds scroll-bars)
	g_canvas.width = (innerWidth * 4 / 4) - xtraMargin;
	g_canvas.height = (innerHeight * 7 / 10) - xtraMargin;
	// IMPORTANT!  Need a fresh drawing in the re-sized viewports.
	drawAll();				// draw in all viewports.
}



var g_last = Date.now();


function myMouseDown(ev, gl, g_canvas) {
	//==============================================================================
	// Called when user PRESSES down any mouse button;
	// 									(Which button?    console.log('ev.button='+ev.button);   )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
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

	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
};


function myMouseMove(ev, gl, g_canvas) {
	//==============================================================================
	// Called when user MOVES the mouse with a button already pressed down.
	// 									(Which button?   console.log('ev.button='+ev.button);    )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if (isDrag == false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - g_canvas.width / 2) / 		// move origin to center of canvas and
		(g_canvas.width / 2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height / 2) /		//										 -1 <= y < +1.
		(g_canvas.height / 2);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	// AND use any mouse-dragging we found to update quaternions qNew and qTot.
	dragQuat(x - xMclik, y - yMclik);

	xMclik = x;													// Make NEXT drag-measurement from here.
	yMclik = y;

	// Show it on our webpage, in the <div> element named 'MouseText':

};

function myMouseUp(ev, gl, g_canvas) {
	//==============================================================================
	// Called when user RELEASES mouse button pressed previously.
	// 									(Which button?   console.log('ev.button='+ev.button);    )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - g_canvas.width / 2) / 		// move origin to center of canvas and
		(g_canvas.width / 2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height / 2) /		//										 -1 <= y < +1.
		(g_canvas.height / 2);
	//	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);

	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
	//	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);

	// AND use any mouse-dragging we found to update quaternions qNew and qTot;
	dragQuat(x - xMclik, y - yMclik);

	// Show it on our webpage, in the <div> element named 'MouseText':

};

function dragQuat(xdrag, ydrag) {
	//==============================================================================

	var res = 5;
	var qTmp = new Quaternion(0, 0, 0, 1);

	var dist = Math.sqrt(xdrag * xdrag + ydrag * ydrag);
	// console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
	qNew.setFromAxisAngle(-ydrag + 0.0001, xdrag + 0.0001, 0.0, dist * 150.0);
	// (why add tiny 0.0001? To ensure we never have a zero-length rotation axis)
	// why axis (x,y,z) = (-yMdrag,+xMdrag,0)? 
	// -- to rotate around +x axis, drag mouse in -y direction.
	// -- to rotate around +y axis, drag mouse in +x direction.

	qTmp.multiply(qNew, qTot);			// apply new rotation to current rotation. 

	qTot.copy(qTmp);
	// show the new quaternion qTot on our webpage in the <div> element 'QuatValue'

};

var slider1 = document.getElementById("nearR");
var slider2 = document.getElementById("farR");
var slider3 = document.getElementById("topR");
var slider4 = document.getElementById("bottomR");
var slider5 = document.getElementById("rightR");
var slider6 = document.getElementById("leftR");


slider1.oninput = function () {
	g_near = slider1.value;
	console.log('g_near is', g_near);
}

slider2.oninput = function () {
	g_far = slider1.value;
	console.log('g_far is', g_far);
}

slider6.oninput = function () {
	leftw = -g_canvas.width / slider6.value;
	console.log('left is', leftw);
}

slider5.oninput = function () {
	rightw = g_canvas.width / slider5.value;
	console.log('right is', rightw);
}

slider3.oninput = function () {
	toph = g_canvas.height / slider3.value;
	console.log('top is', toph);
}

slider4.oninput = function () {
	bottomh = -g_canvas.height / slider4.value;
	console.log('bottom is', bottomh);
}



