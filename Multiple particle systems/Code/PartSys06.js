//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)

// Set 'tab' to 2 spaces (for best on-screen appearance)

/*
================================================================================
================================================================================

                              PartSys Library

================================================================================
================================================================================
Prototype object that contains one complete particle system, including:
 -- state-variables s1, s2, & more that each describe a complete set of 
  particles at a fixed instant in time. Each state-var is a Float32Array that 
  hold the parameters of this.targCount particles (defined by constructor).
 -- Each particle is an identical sequence of floating-point parameters defined 
  by the extensible set of array-index names defined as constants near the top 
  of this file.  For example: PART_XPOS for x-coordinate of position, PART_YPOS 
  for particle's y-coord, and finally PART_MAXVAL defines total # of parameters.
  To access parameter PART_YVEL of the 17th particle in state var s1, use:
  this.s1[PART_YVEL + 17*PART_MAXVAL].
 -- A collection of 'force-causing' objects in forceList array
                                                  (see CForcer prototype below),
 -- A collection of 'constraint-imposing' objects in limitList array
                                                  (see CLimit prototype below),
 -- Particle-system computing functions described in class notes: 
  init(), applyForces(), dotFinder(), render(), doConstraints(), step().
 
 HOW TO USE:
 ---------------
 a) Be sure your WebGL rendering context is available as the global var 'gl'.
 b) Create a global variable for each independent particle system:
  e.g.    g_PartA = new PartSys(500);   // 500-particle fire-like system 
          g_partB = new PartSys(32);    //  32-particle spring-mass system
          g_partC = new PartSys(1024);  // 1024-particle smoke-like system
          ...
 c) Modify each particle-system as needed to get desired results:
    g_PartA.init(3);  g_PartA.solvType = SOLV_ADAMS_BASHFORTH; etc...
 d) Be sure your program's animation method (e.g. 'drawAll') calls the functions
    necessary for the simulation process of all particle systems, e.g.
      in main(), call g_partA.init(), g_partB.init(), g_partC.init(), ... etc
      in drawAll(), call:
        g_partA.applyForces(), g_partB.applyForces(), g_partC.applyForces(), ...
        g_partA.dotFinder(),   g_partB.dotFinder(),   g_partC.dotFinder(), ...
        g_partA.render(),      g_partB.render(),      g_partC.render(), ...
        g_partA.solver(),      g_partB.solver(),      g_partC.solver(), ...
        g_partA.doConstraint(),g_partB.doConstraint(),g_partC.doConstraint(),...
        g_partA.step(),        g_partB.step(),        g_partC.step().

*/

// Array-name consts for all state-variables in PartSys object:
/*------------------------------------------------------------------------------
     Each state-variable is a Float32Array object that holds 'this.partCount' 
particles. For each particle the state var holds exactly PART_MAXVAR elements 
(aka the 'parameters' of the particle) arranged in the sequence given by these 
array-name consts below.  
     For example, the state-variable object 'this.s1' is a Float32Array that 
holds this.partCount particles, and each particle is described by a sequence of
PART_MAXVAR floating-point parameters; in other words, the 'stride' that moves
use from a given parameter in one particle to the same parameter in the next
particle is PART_MAXVAR. Suppose we wish to find the Y velocity parameter of 
particle number 17 in s1 ('first' particle is number 0): we can
get that value if we write: this.s1[PART_XVEL + 17*PART_MAXVAR].
------------------------------------------------------------------------------*/
const PART_XPOS = 0;  //  position    
const PART_YPOS = 1;
const PART_ZPOS = 2;
const PART_WPOS = 3;            // (why include w? for matrix transforms; 
// for vector/point distinction
const PART_XVEL = 4;  //  velocity -- ALWAYS a vector: x,y,z; no w. (w==0)    
const PART_YVEL = 5;
const PART_ZVEL = 6;
const PART_X_FTOT = 7;  // force accumulator:'ApplyForces()' fcn clears
const PART_Y_FTOT = 8;  // to zero, then adds each force to each particle.
const PART_Z_FTOT = 9;
const PART_R = 10;  // color : red,green,blue, alpha (opacity); 0<=RGBA<=1.0
const PART_G = 11;
const PART_B = 12;
const PART_LIFELEFT = 13;
const PART_MASS = 14;  	// mass, in kilograms
const PART_DIAM = 15;	// on-screen diameter (in pixels)
const PART_RENDMODE = 16;	// on-screen appearance (square, round, or soft-round)
// Other useful particle values, currently unused
const PART_AGE = 17;  // # of frame-times until re-initializing (Reeves Fire)
/*
const PART_CHARGE   =17;  // for electrostatic repulsion/attraction
const PART_MASS_VEL =18;  // time-rate-of-change of mass.
const PART_MASS_FTOT=19;  // force-accumulator for mass-change
const PART_R_VEL    =20;  // time-rate-of-change of color:red
const PART_G_VEL    =21;  // time-rate-of-change of color:grn
const PART_B_VEL    =22;  // time-rate-of-change of color:blu
const PART_R_FTOT   =23;  // force-accumulator for color-change: red
const PART_G_FTOT   =24;  // force-accumulator for color-change: grn
const PART_B_FTOT   =25;  // force-accumulator for color-change: blu
*/
const PART_MAXVAR = 18;  // Size of array in CPart uses to store its values.

// eye_x = -5.5, eye_y = 0.5, eye_z = 0.2;
// var g_theta = 0.01;
// var g_delta = 0.05;
var canvas = document.getElementById('webgl');

// Array-Name consts that select PartSys objects' numerical-integration solver:
//------------------------------------------------------------------------------
// EXPLICIT methods: GOOD!
//    ++ simple, easy to understand, fast, but
//    -- Requires tiny time-steps for stable stiff systems, because
//    -- Errors tend to 'add energy' to any dynamical system, driving
//        many systems to instability even with small time-steps.
const SOLV_EULER = 0;       // Euler integration: forward,explicit,...
const SOLV_MIDPOINT = 1;       // Midpoint Method (see Pixar Tutorial)
const SOLV_ADAMS_BASH = 2;       // Adams-Bashforth Explicit Integrator
const SOLV_RUNGEKUTTA = 3;       // Arbitrary degree, set by 'solvDegree'

// IMPLICIT methods:  BETTER!
//          ++Permits larger time-steps for stiff systems, but
//          --More complicated, slower, less intuitively obvious,
//          ++Errors tend to 'remove energy' (ghost friction; 'damping') that
//              aids stability even for large time-steps.
//          --requires root-finding (iterative: often no analytical soln exists)
const SOLV_OLDGOOD = 4;      //  early accidental 'good-but-wrong' solver
const SOLV_BACK_EULER = 5;      // 'Backwind' or Implicit Euler
const SOLV_BACK_MIDPT = 6;      // 'Backwind' or Implicit Midpoint
const SOLV_BACK_ADBASH = 7;      // 'Backwind' or Implicit Adams-Bashforth

// SEMI-IMPLICIT METHODS: BEST?
//          --Permits larger time-steps for stiff systems,
//          ++Simpler, easier-to-understand than Implicit methods
//          ++Errors tend to 'remove energy) (ghost friction; 'damping') that
//              aids stability even for large time-steps.
//          ++ DOES NOT require the root-finding of implicit methods,
const SOLV_VERLET = 8;       // Verlet semi-implicit integrator;
const SOLV_VEL_VERLET = 9;       // 'Velocity-Verlet'semi-implicit integrator
const SOLV_LEAPFROG = 10;      // 'Leapfrog' integrator
const SOLV_MAX = 11;      // number of solver types available.

const NU_EPSILON = 10E-15;         // a tiny amount; a minimum vector length
// to use to avoid 'divide-by-zero'

//=============================================================================
//==============================================================================
function PartSys() {
  //==============================================================================
  //=============================================================================
  // Constructor for a new particle system.
  this.randX = 0;   // random point chosen by call to roundRand()
  this.randY = 0;
  this.randZ = 0;
  this.isFountain = 0;  // Press 'f' or 'F' key to toggle; if 1, apply age 
  // age constraint, which re-initializes particles whose
  // lifetime falls to zero, forming a 'fountain' of
  // freshly re-initialized bouncy-balls.
  this.isTornado = 0;
  this.forceList = [];            // (empty) array to hold CForcer objects
  // for use by ApplyAllForces().
  // NOTE: this.forceList.push("hello"); appends
  // string "Hello" as last element of forceList.
  // console.log(this.forceList[0]); prints hello.
  this.limitList = [];            // (empty) array to hold CLimit objects
  // for use by doContstraints()
}
// HELPER FUNCTIONS:
//=====================
// Misc functions that don't fit elsewhere

PartSys.prototype.roundRand = function () {
  //==============================================================================
  // When called, find a new 3D point (this.randX, this.randY, this.randZ) chosen 
  // 'randomly' and 'uniformly' inside a sphere of radius 1.0 centered at origin.  
  //		(within this sphere, all regions of equal volume are equally likely to
  //		contain the the point (randX, randY, randZ, 1).

  do {			// RECALL: Math.random() gives #s with uniform PDF between 0 and 1.
    this.randX = 2.0 * Math.random() - 1.0; // choose an equally-likely 2D point
    this.randY = 2.0 * Math.random() - 1.0; // within the +/-1 cube, but
    this.randZ = 2.0 * Math.random() - 1.0;
  }       // is x,y,z outside sphere? try again!
  while (this.randX * this.randX +
  this.randY * this.randY +
  this.randZ * this.randZ >= 1.0);
}

// INIT FUNCTIONS:
//==================
// Each 'init' function initializes everything in our particle system. Each 
// creates all necessary state variables, force-applying objects, 
// constraint-applying objects, solvers and all other values needed to prepare
// the particle-system to run without any further adjustments.

PartSys.prototype.initBouncy2D = function (count) {
  //==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);
  // NOTE: Float32Array objects are zero-filled by default.

  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and
  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // drag for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
  // (WARNING! until we do this, fTmp refers to
  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.15;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // tornado for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
  // (WARNING! until we do this, fTmp refers to
  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_GRAV_E;        // Viscous Drag
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // Report:
  console.log("PartSys.initBouncy2D() created PartSys.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for (i = 0; i < this.forceList.length; i++) {
    console.log("CForceList[", i, "]");
    this.forceList[i].printMe();
  }

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_VOL;       // confine particles inside axis-aligned 
  // rectangular volume that
  cTmp.targFirst = 0;             // applies to ALL particles; starting at 0 
  cTmp.partCount = -1;            // through all the rest of them.
  cTmp.xMin = -1.0; cTmp.xMax = 1.0;  // box extent:  +/- 1.0 box at origin
  cTmp.yMin = -1.0; cTmp.yMax = 1.0;
  cTmp.zMin = -1.0; cTmp.zMax = 1.0;
  cTmp.Kresti = 1.0;              // bouncyness: coeff. of restitution.
  // (and IGNORE all other CLimit members...)
  this.limitList.push(cTmp);      // append this 'box' constraint object to the
  // 'limitList' array of constraint-causing objects.                                
  // Report:
  console.log("PartSys.initBouncy2D() created PartSys.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");

  this.INIT_VEL = 0.15 * 60.0;		// initial velocity in meters/sec.
  // adjust by ++Start, --Start buttons. Original value 
  // was 0.15 meters per timestep; multiply by 60 to get
  // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
  // inelastic collisions.  Sets the fraction of momentum 
  // (0.0 <= resti < 1.0) that remains after a ball 
  // 'bounces' on a wall or floor, as computed using 
  // velocity perpendicular to the surface. 
  // (Recall: momentum==mass*velocity.  If ball mass does 
  // not change, and the ball bounces off the x==0 wall,
  // its x velocity xvel will change to -xvel * resti ).

  //--------------------------init Particle System Controls:
  this.runMode = 3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_OLDGOOD;// adjust by s/S keys.
  // SOLV_EULER (explicit, forward-time, as 
  // found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
  // SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
  // as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 1;	// floor-bounce constraint type:
  // ==0 for velocity-reversal, as in all previous versions
  // ==1 for Chapter 3's collision resolution method, which
  // uses an 'impulse' to cancel any velocity boost caused
  // by falling below the floor.

  //--------------------------------Create & fill VBO with state var s1 contents:
  // INITIALIZE s1, s2:
  //  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
  // That's OK for most particle parameters, but these need non-zero defaults:

  var j = 0;  // i==particle number; j==array index for i-th particle
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    this.roundRand();       // set this.randX,randY,randZ to random location in 
    // a 3D unit sphere centered at the origin.
    //all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (-0.8,-0.8,-0.8)
    this.s1[j + PART_XPOS] = -0.8 + 0.1 * this.randX;
    this.s1[j + PART_YPOS] = -0.8 + 0.1 * this.randY;
    this.s1[j + PART_ZPOS] = -0.8 + 0.1 * this.randZ;
    this.s1[j + PART_WPOS] = 1.0;      // position 'w' coordinate;
    this.roundRand(); // Now choose random initial velocities too:
    this.s1[j + PART_XVEL] = this.INIT_VEL * (0.4 + 0.2 * this.randX);
    this.s1[j + PART_YVEL] = this.INIT_VEL * (0.4 + 0.2 * this.randY);
    this.s1[j + PART_ZVEL] = this.INIT_VEL * (0.4 + 0.2 * this.randZ);
    this.s1[j + PART_MASS] = 1.0;      // mass, in kg.
    this.s1[j + PART_DIAM] = 2.0 + 10 * Math.random(); // on-screen diameter, in pixels
    this.s1[j + PART_LIFELEFT] = 10 + 10 * Math.random();// 10 to 20
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100 * Math.random();
    //----------------------------
    this.s2.set(this.s1);   // COPY contents of state-vector s1 to s2.
  }

}

PartSys.prototype.initBouncy3D = function (count) {
  //==============================================================================
  console.log('PartSys.initBouncy3D() stub not finished!');
}

PartSys.prototype.initFireReeves = function (count) {
  //==============================================================================

  this.partCount = count;
  this.s1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);
  // Float32Array objects are zero-filled by default
  // for midpoint solver:
  this.sM = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot = new Float32Array(this.partCount * PART_MAXVAR);

  // use fountain like effect for Reeves Fire
  this.isFountain = true;

  // Create force-causing objects:
  var fTmp = new CForcer();

  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;
  // reduce gravity effect
  fTmp.gravConst = 0.0;
  // set it to affect ALL particles
  fTmp.targFirst = 0;
  // (negative value means ALL particles)
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);

  // drag for all particles:
  fTmp = new CForcer();
  // Viscous Drag
  fTmp.forceType = F_DRAG;
  // in Euler solver, scales velocity by 0.85
  fTmp.Kdrag = 0.15;
  // apply it to ALL particles
  fTmp.targFirst = 0;
  // negative value means ALL particles
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);

  // add wind force
  fTmp = new CForcer();
  fTmp.forceType = F_WIND;
  fTmp.K_wind = 10.0;
  // set it to affect ALL particles
  fTmp.targFirst = 0;
  // (negative value means ALL particles)
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);




  // Create constraint-causing objects:
  var cTmp = new CLimit();
  // set how particles 'bounce' from its surface
  cTmp.hitType = HIT_BOUNCE_VEL;
  // confine particles inside axis-aligned rectangular volume
  cTmp.limitType = LIM_VOL;
  // applies to ALL particles; starting at 0
  cTmp.targFirst = 0;
  // through all the rest of them
  cTmp.partCount = -1;
  // box extent:  +/- 1.0 box at origin
  cTmp.xMin = -10.0; cTmp.xMax = 20.0;
  cTmp.yMin = -10.0; cTmp.yMax = 20.0;
  cTmp.zMin = 10.0; cTmp.zMax = 20.0;
  // bouncyness: coeff. of restitution.
  cTmp.Kresti = 1.0;
  // (and IGNORE all other CLimit members...)
  // append this to array of constraint-causing objects
  this.limitList.push(cTmp);





  // initial velocity in meters/sec.
  // adjust by ++Start, --Start buttons. Original value 
  // was 0.15 meters per timestep; multiply by 60 to get meters per second.
  this.INIT_VEL = 1.0 * 50.0;

  // units-free air-drag (scales velocity); adjust by d/D keys
  this.drag = 0.985;
  // gravity's acceleration(meter/sec^2); adjust by g/G keys
  this.grav = 9.832;
  // units-free 'Coefficient of Restitution'
  this.resti = 1.0;




  // Initialize Particle System Controls:

  // Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.runMode = 3;
  // adjust by s/S keys
  this.solvType = SOLV_MIDPOINT;
  // floor-bounce constraint type:
  // ==0 for velocity-reversal, as in all previous versions
  // ==1 for Chapter 3's collision resolution method, which uses
  // an 'impulse' to cancel any velocity boost caused by falling below the floor
  this.bounceType = 1;


  var j = 0;
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    // set this.randX,randY,randZ to random location in
    // a 3D unit sphere centered at the origin
    this.roundRand();
    // all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (0.8,0.8,0.8)
    this.s1[j + PART_XPOS] = 1.0 * this.randX;
    this.s1[j + PART_YPOS] = 1.0 * this.randY;
    this.s1[j + PART_ZPOS] = 0.6 + 0.5 * this.randZ;
    this.s1[j + PART_WPOS] = 1.0;

    // Now choose random initial velocities too:
    this.roundRand();
    this.s1[j + PART_XVEL] = (-this.s1[j + PART_XPOS]) * this.INIT_VEL * (0.0 + 0.2 * this.randX);
    this.s1[j + PART_YVEL] = (-this.s1[j + PART_YPOS]) * this.INIT_VEL * (0.0 + 0.2 * this.randY);
    this.s1[j + PART_ZVEL] = this.INIT_VEL * (0.6 + 0.2 * this.randZ);

    // distance of particle from center:
    var radius = Math.sqrt(Math.pow(this.s1[j + PART_XPOS], 2) + Math.pow(this.s1[j + PART_YPOS], 2));
    radius = Math.pow(radius, 1.5);

    // give initial color to the particles
    this.s1[j + PART_R] = 1.0 * radius + 1.0 * (1.0 - radius);
    this.s1[j + PART_G] = 0.0 * radius + 1.0 * (1.0 - radius);
    this.s1[j + PART_B] = 0.0 * radius + 0.0 * (1.0 - radius);


    // mass, in kg.
    this.s1[j + PART_MASS] = 1.0;
    // on-screen diameter, in pixels
    this.s1[j + PART_DIAM] = 8.0 + 1.0 * Math.random();
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 1 * (1.5 - radius) + 3 * Math.random();
  }
  // COPY contents of state-vector s1 to s2
  this.s2.set(this.s1);



  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.
  // Create a vertex buffer object (VBO) in the graphics hardware: get its ID# 
  this.vboID = gl.createBuffer();
  if (!this.vboID) {
    console.log('PartSys.init() Failed to create the VBO object in the GPU');
    return -1;
  }
  // "Bind the new buffer object (memory in the graphics system) to target"
  // In other words, specify the usage of one selected buffer object.
  // What's a "Target"? it's the poorly-chosen OpenGL/WebGL name for the 
  // intended use of this buffer's memory; so far, we have just two choices:
  //	== "gl.ARRAY_BUFFER" meaning the buffer object holds actual values we 
  //      need for rendering (positions, colors, normals, etc), or 
  //	== "gl.ELEMENT_ARRAY_BUFFER" meaning the buffer object holds indices 
  // 			into a list of values we need; indices such as object #s, face #s, 
  //			edge vertex #s.
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);

  // Write data from our JavaScript array to graphics systems' buffer object:
  gl.bufferData(gl.ARRAY_BUFFER, this.s1, gl.DYNAMIC_DRAW);
  // why 'DYNAMIC_DRAW'? Because we change VBO's content with bufferSubData() later

  // ---------Set up all attributes for VBO contents:
  //Get the ID# for the a_Position variable in the graphics hardware
  this.a_PositionID = gl.getAttribLocation(gl.program, 'a_Position');
  if (this.a_PositionID < 0) {
    console.log('PartSys.init() Failed to get the storage location of a_Position');
    return -1;
  }
  // Tell GLSL to fill the 'a_Position' attribute variable for each shader with
  // values from the buffer object chosen by 'gl.bindBuffer()' command.
  // websearch yields OpenGL version: 
  //		http://www.opengl.org/sdk/docs/man/xhtml/glVertexAttribPointer.xml
  gl.vertexAttribPointer(this.a_PositionID,
    4,  // # of values in this attrib (1,2,3,4) 
    gl.FLOAT, // data type (usually gl.FLOAT)
    false,    // use integer normalizing? (usually false)
    PART_MAXVAR * this.FSIZE,  // Stride: #bytes from 1st stored value to next one
    PART_XPOS * this.FSIZE); // Offset; #bytes from start of buffer to 
  // 1st stored attrib value we will actually use.
  // Enable this assignment of the bound buffer to the a_Position variable:
  gl.enableVertexAttribArray(this.a_PositionID);


  // --- NEW! particle 'age' attribute:--------------------------------
  //Get the ID# for the a_LifeLeft variable in the graphics hardware
  this.a_LifeLeftID = gl.getAttribLocation(gl.program, 'a_LifeLeft');
  if (this.a_LifeLeftID < 0) {
    console.log('PartSys.init() Failed to get the storage location of a_LifeLeft');
    return -1;
  }
  // Tell GLSL to fill the 'a_LifeLeft' attribute variable for each shader with
  // values from the buffer object chosen by 'gl.bindBuffer()' command.
  // websearch yields OpenGL version: 
  //		http://www.opengl.org/sdk/docs/man/xhtml/glVertexAttribPointer.xml
  gl.vertexAttribPointer(this.a_LifeLeftID,
    1,  // # of values in this attrib (1,2,3,4) 
    gl.FLOAT, // data type (usually gl.FLOAT)
    false,    // use integer normalizing? (usually false)
    PART_MAXVAR * this.FSIZE,  // Stride: #bytes from 1st stored value to next one
    PART_LIFELEFT * this.FSIZE); // Offset; #bytes from start of buffer to 
  // 1st stored attrib value we will actually use.
  // Enable this assignment of the bound buffer to the a_Position variable:
  gl.enableVertexAttribArray(this.a_LifeLeftID);

  //------------------------------------------
  // ---------Set up all uniforms we send to the GPU:
  // Get graphics system storage location of each uniform our shaders use:
  // (why? see  http://www.opengl.org/wiki/Uniform_(GLSL) )
  this.u_runModeID = gl.getUniformLocation(gl.program, 'u_runMode');
  if (!this.u_runModeID) {
    console.log('PartSys.init() Failed to get u_runMode variable location');
    return;
  }
  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
  gl.uniform1i(this.u_runModeID, this.runMode);
}

PartSys.prototype.initTornado = function (count) {
  //==============================================================================
  // Create all state-variables-------------------------------------------------
  this.partCount = count;
  this.s1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);
  // NOTE: Float32Array objects are zero-filled by default.

  this.sM = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot = new Float32Array(this.partCount * PART_MAXVAR);

  this.isTornado = true;  //create circle force effect in the beginning
  // Create & init all force-causing objects------------------------------------
  var fTmp = new CForcer();       // create a force-causing object, and
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;      // set it to earth gravity, and
  fTmp.targFirst = 0;             // set it to affect ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // drag for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
  // (WARNING! until we do this, fTmp refers to
  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_DRAG;        // Viscous Drag
  fTmp.Kdrag = 0.15;              // in Euler solver, scales velocity by 0.85
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // tornado for all particles:
  fTmp = new CForcer();           // create a NEW CForcer object 
  // (WARNING! until we do this, fTmp refers to
  // the same memory locations as forceList[0]!!!) 
  fTmp.forceType = F_TORNADO;        // Viscous Drag
  fTmp.targFirst = 0;             // apply it to ALL particles:
  fTmp.partCount = -1;            // (negative value means ALL particles)
  // (and IGNORE all other Cforcer members...)
  this.TornadoCenter = new Vector4([0, 0, 0, 1]);
  // range of the tornado
  tornadoRadius = 1.0;
  // height upto which Tornado will work
  tornadoHeight = 20.0;


  this.forceList.push(fTmp);      // append this 'gravity' force object to 
  // the forceList array of force-causing objects.
  // Report:
  console.log("PartSys.initBouncy2D() created PartSys.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for (i = 0; i < this.forceList.length; i++) {
    console.log("CForceList[", i, "]");
    this.forceList[i].printMe();
  }

  // Create & init all constraint-causing objects-------------------------------
  var cTmp = new CLimit();      // creat constraint-causing object, and
  cTmp.hitType = HIT_BOUNCE_VEL;  // set how particles 'bounce' from its surface,
  cTmp.limitType = LIM_VOL;       // confine particles inside axis-aligned 
  // rectangular volume that
  cTmp.targFirst = 0;             // applies to ALL particles; starting at 0 
  cTmp.partCount = -1;            // through all the rest of them.
  cTmp.xMin = -10.0; cTmp.xMax = 10.0;
  cTmp.yMin = -10.0; cTmp.yMax = 10.0;
  cTmp.zMin = 0.0; cTmp.zMax = 15.0;
  this.xMin = -10.0; this.xMax = 10.0;
  this.yMin = -10.0; this.yMax = 10.0;
  this.zMin = 0.0; this.zMax = 15.0;
  cTmp.Kresti = 1.0;              // bouncyness: coeff. of restitution.
  // (and IGNORE all other CLimit members...)
  this.limitList.push(cTmp);      // append this 'box' constraint object to the
  // 'limitList' array of constraint-causing objects.                                
  // Report:


  this.INIT_VEL = 0.15 * 60.0;		// initial velocity in meters/sec.
  // adjust by ++Start, --Start buttons. Original value 
  // was 0.15 meters per timestep; multiply by 60 to get
  // meters per second.
  this.drag = 0.985;// units-free air-drag (scales velocity); adjust by d/D keys
  this.grav = 9.832;// gravity's acceleration(meter/sec^2); adjust by g/G keys.
  // on Earth surface, value is 9.832 meters/sec^2.
  this.resti = 1.0; // units-free 'Coefficient of Restitution' for 
  // inelastic collisions.  Sets the fraction of momentum 
  // (0.0 <= resti < 1.0) that remains after a ball 
  // 'bounces' on a wall or floor, as computed using 
  // velocity perpendicular to the surface. 
  // (Recall: momentum==mass*velocity.  If ball mass does 
  // not change, and the ball bounces off the x==0 wall,
  // its x velocity xvel will change to -xvel * resti ).

  //--------------------------init Particle System Controls:
  this.runMode = 3;// Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.solvType = SOLV_MIDPOINT;// adjust by s/S keys.
  // SOLV_EULER (explicit, forward-time, as 
  // found in BouncyBall03.01BAD and BouncyBall04.01badMKS)
  // SOLV_OLDGOOD for special-case implicit solver, reverse-time, 
  // as found in BouncyBall03.GOOD, BouncyBall04.goodMKS)
  this.bounceType = 0;	// floor-bounce constraint type:
  // ==0 for velocity-reversal, as in all previous versions
  // ==1 for Chapter 3's collision resolution method, which
  // uses an 'impulse' to cancel any velocity boost caused
  // by falling below the floor.

  //--------------------------------Create & fill VBO with state var s1 contents:
  // INITIALIZE s1, s2:
  //  NOTE: s1,s2 are a Float32Array objects, zero-filled by default.
  // That's OK for most particle parameters, but these need non-zero defaults:
  var j = 0;
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    // set this.randX,randY,randZ to random location in
    // a 3D unit sphere centered at the origin
    this.roundRand();
    // all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (0.8,0.8,0.8)
    this.s1[j + PART_ZPOS] = 1.5 + 2.0 * this.randZ;
    this.s1[j + PART_XPOS] = 0.0 + (this.s1[PART_ZPOS] + 2.0) * this.randX;
    this.s1[j + PART_YPOS] = 0.0 + (this.s1[PART_ZPOS] + 2.0) * this.randY;
    this.s1[j + PART_WPOS] = 1.0;

    // Now choose random initial velocities too:
    this.roundRand();
    this.s1[j + PART_XVEL] = this.INIT_VEL * (0.2 * this.randX);
    this.s1[j + PART_YVEL] = this.INIT_VEL * (0.2 * this.randY);
    this.s1[j + PART_ZVEL] = this.INIT_VEL * (0.2);// + 0.2*this.randZ);



    // mass, in kg.
    this.s1[j + PART_MASS] = 1.0;
    // on-screen diameter, in pixels
    this.s1[j + PART_DIAM] = 2.0 + 10 * Math.random();
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 20 + 5 * Math.random();
  }
  // COPY contents of state-vector s1 to s2
  this.s2.set(this.s1);





  this.FSIZE = this.s1.BYTES_PER_ELEMENT;  // 'float' size, in bytes.
  // Create a vertex buffer object (VBO) in the graphics hardware: get its ID# 
  this.vboID = gl.createBuffer();
  if (!this.vboID) {
    console.log('PartSys.init() Failed to create the VBO object in the GPU');
    return -1;
  }
  // "Bind the new buffer object (memory in the graphics system) to target"
  // In other words, specify the usage of one selected buffer object.
  // What's a "Target"? it's the poorly-chosen OpenGL/WebGL name for the 
  // intended use of this buffer's memory; so far, we have just two choices:
  //	== "gl.ARRAY_BUFFER" meaning the buffer object holds actual values we 
  //      need for rendering (positions, colors, normals, etc), or 
  //	== "gl.ELEMENT_ARRAY_BUFFER" meaning the buffer object holds indices 
  // 			into a list of values we need; indices such as object #s, face #s, 
  //			edge vertex #s.
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vboID);

  // Write data from our JavaScript array to graphics systems' buffer object:
  gl.bufferData(gl.ARRAY_BUFFER, this.s1, gl.DYNAMIC_DRAW);
  // why 'DYNAMIC_DRAW'? Because we change VBO's content with bufferSubData() later

  // ---------Set up all attributes for VBO contents:
  //Get the ID# for the a_Position variable in the graphics hardware
  this.a_PositionID = gl.getAttribLocation(gl.program, 'a_Position');
  if (this.a_PositionID < 0) {
    console.log('PartSys.init() Failed to get the storage location of a_Position');
    return -1;
  }
  // Tell GLSL to fill the 'a_Position' attribute variable for each shader with
  // values from the buffer object chosen by 'gl.bindBuffer()' command.
  // websearch yields OpenGL version: 
  //		http://www.opengl.org/sdk/docs/man/xhtml/glVertexAttribPointer.xml
  gl.vertexAttribPointer(this.a_PositionID,
    4,  // # of values in this attrib (1,2,3,4) 
    gl.FLOAT, // data type (usually gl.FLOAT)
    false,    // use integer normalizing? (usually false)
    PART_MAXVAR * this.FSIZE,  // Stride: #bytes from 1st stored value to next one
    PART_XPOS * this.FSIZE); // Offset; #bytes from start of buffer to 
  // 1st stored attrib value we will actually use.
  // Enable this assignment of the bound buffer to the a_Position variable:
  gl.enableVertexAttribArray(this.a_PositionID);




  //------------------------------------------
  // ---------Set up all uniforms we send to the GPU:
  // Get graphics system storage location of each uniform our shaders use:
  // (why? see  http://www.opengl.org/wiki/Uniform_(GLSL) )
  this.u_runModeID = gl.getUniformLocation(gl.program, 'u_runMode');
  if (!this.u_runModeID) {
    console.log('PartSys.init() Failed to get u_runMode variable location');
    return;
  }
  // Set the initial values of all uniforms on GPU: (runMode set by keyboard)
  gl.uniform1i(this.u_runModeID, this.runMode);




}
PartSys.prototype.initFlocking = function (count) {
  // //==============================================================================
  this.partCount = count;
  this.s1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);
  // for midpoint solver:
  this.sM = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot = new Float32Array(this.partCount * PART_MAXVAR);
  // Float32Array objects are zero-filled by default

  // Create force-causing objects:
  var fTmp = new CForcer();
  // fTmp = new CForcer();
  // Boids (Flocking )
  fTmp.forceType = F_BOIDS;
  // in Euler solver, scales velocity by 0.85
  // fTmp.Kdrag = 0.15;
  // apply it to ALL particles
  fTmp.targFirst = 0;
  // negative value means ALL particles
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects

  this.forceList.push(fTmp);

  // specify the scaling factor for all the rules of boids sytem
  this.scalingBoid = {
    Cohesive: 0.5,
    Repulsive: 0.2,
    Velocity: 1.0,
    Obstacle: 0.1,
  }

  // specify how much neighbourhood to account for while simulation
  this.flockNb = {
    Cohesive: 15,
    Repulsive: 10,
    Velocity: 15,
    Obstacle: 10,
  }

  // define obstacle position:
  this.obstPos = {
    x: 0,
    y: 0,
    z: 0,
  }






  // Create constraint-causing objects:
  var cTmp = new CLimit();
  // set how particles 'bounce' from its surface
  cTmp.hitType = -1;//HitType.BounceVelocityReversal;
  // confine particles inside axis-aligned rectangular volume
  cTmp.limitType = LIM_VOL;
  // applies to ALL particles; starting at 0
  cTmp.targFirst = 0;
  // through all the rest of them
  cTmp.partCount = -1;
  // box extent:  +/- 1.0 box at origin
  cTmp.xMin = this.xMin = -20.0;
  cTmp.xMax = this.xMax = 20.0;
  cTmp.yMin = this.yMin = -10.0;
  cTmp.yMax = this.yMax = 10.0;
  cTmp.zMin = this.zMin = -10.0;
  cTmp.zMax = this.zMax = 10.0;

  // (and IGNORE all other CLimit members...)
  // append this to array of constraint-causing objects
  this.limitList.push(cTmp);



  // initial velocity in meters/sec.
  // adjust by ++Start, --Start buttons. Original value 
  // was 0.15 meters per timestep; multiply by 60 to get meters per second.
  this.INIT_VEL = 0.15 * 60.0;

  // units-free air-drag (scales velocity); adjust by d/D keys
  this.drag = 0.985;
  // gravity's acceleration(meter/sec^2); adjust by g/G keys
  this.grav = 9.832;
  // units-free 'Coefficient of Restitution'
  this.resti = 1.0;




  // Initialize Particle System Controls:

  // Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.runMode = 3;
  // adjust by s/S keys
  this.solvType = SOLV_MIDPOINT;
  // floor-bounce constraint type:
  // ==0 for velocity-reversal, as in all previous versions
  // ==1 for Chapter 3's collision resolution method, which uses
  // an 'impulse' to cancel any velocity boost caused by falling below the floor
  this.bounceType = -1;




  // Create and fill VBO with state s1 contents:

  // i = particle number; j = array index for i-th particle
  var j = 0;
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    // set this.randX,randY,randZ to random location in
    // a 3D unit sphere centered at the origin
    this.roundRand();
    // all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
    // set random positions in a 0.1-radius ball centered at (0.8,0.8,0.8)
    this.s1[j + PART_XPOS] = 5 + 5 * this.randX;
    this.s1[j + PART_YPOS] = 5 + 5 * this.randY;
    this.s1[j + PART_ZPOS] = 5 + 5 * this.randZ;
    this.s1[j + PART_WPOS] = 1.0;

    // Now choose random initial velocities too:
    this.roundRand();
    this.s1[j + PART_XVEL] = this.INIT_VEL * (-1.0 + 0.5 * this.randX);
    this.s1[j + PART_YVEL] = this.INIT_VEL * (0.05 * this.randY);
    this.s1[j + PART_ZVEL] = this.INIT_VEL * (0.05 * this.randZ);



    // mass, in kg.
    this.s1[j + PART_MASS] = 1.0;
    // on-screen diameter, in pixels
    this.s1[j + PART_DIAM] = 2.0 + 10 * Math.random();
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 50 + 50 * Math.random();
  }
  // COPY contents of state-vector s1 to s2
  this.s2.set(this.s1);





}
PartSys.prototype.initSpringPair = function (count) {
  //==============================================================================
  this.partCount = count;
  this.s1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s1dot = new Float32Array(this.partCount * PART_MAXVAR);
  // for midpoint solver:
  this.sM = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot = new Float32Array(this.partCount * PART_MAXVAR);
  // for Back Euler:
  this.s20 = new Float32Array(this.partCount * PART_MAXVAR);
  this.s2dot0 = new Float32Array(this.partCount * PART_MAXVAR);
  // for Back Midpoint:
  this.sM0 = new Float32Array(this.partCount * PART_MAXVAR);
  this.sM1 = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot0 = new Float32Array(this.partCount * PART_MAXVAR);
  this.sMdot1 = new Float32Array(this.partCount * PART_MAXVAR);
  // Float32Array objects are zero-filled by default


  // for this Cloth only:
  var K_spring = 10.0
  var K_springDamp = 0.07;
  var K_restLength = 1.0;


  // Create force-causing objects:
  var fTmp;

  var indexarray = [];

  nIndexCount = 0;

  // 2 more particles at the end to hold the cloth
  var p1 = 0;
  var p2 = 1;
  indexarray = indexarray.concat(p1, p2);
  // create spring force
  fTmp = new CForcer();
  // Two particle spring system:
  fTmp.forceType = F_SPRING;
  // set it to affect ALL particles
  fTmp.targFirst = 0;
  // For springs, set targCount=0 & use e1,e2
  fTmp.targCount = 0;
  // start point particle number
  fTmp.e1 = p1;
  // end point particle number
  fTmp.e2 = p2;
  // Spring constant: force = stretchDistance*K_spring
  fTmp.K_spring = K_spring;
  // Spring damping: (friction within the spring)
  fTmp.K_springDamp = K_springDamp;
  // the zero-force length of this spring.      
  fTmp.K_restLength = K_restLength;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);
  // indexCount increment
  nIndexCount = nIndexCount + 2;


  // create the list of indices and assign the count
  this.indices = new Uint16Array(indexarray);
  this.indexCount = nIndexCount;



  // drag for all particles:
  fTmp = new CForcer();
  // Viscous Drag
  fTmp.forceType = F_DRAG;
  // in Euler solver, scales velocity by 0.85
  fTmp.Kdrag = 0.1;
  // apply it to ALL particles
  fTmp.targFirst = 0;
  // negative value means ALL particles
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);

  // gravity for all particles
  fTmp = new CForcer();
  // earth gravity for all particles:
  fTmp.forceType = F_GRAV_E;
  // set it to affect ALL particles
  fTmp.targFirst = 0;
  // (negative value means ALL particles)
  fTmp.partCount = -1;
  // (and IGNORE all other Cforcer members...)
  // append this to the forceList array of force-causing objects
  this.forceList.push(fTmp);



  // Report:
  console.log("PartSys.Cloth() created PartSys.forceList[] array of ");
  console.log("\t\t", this.forceList.length, "CForcer objects:");
  for (i = 0; i < this.forceList.length; i++) {
    console.log("CForceList[", i, "]");
    this.forceList[i].printMe();
  }






  // Create constraint-causing objects:
  var cTmp = new CLimit();
  // set how particles 'bounce' from its surface
  cTmp.hitType = HIT_BOUNCE_IMP;
  // confine particles inside axis-aligned rectangular volume
  cTmp.limitType = LIM_VOL;
  // applies to ALL particles; starting at 0
  cTmp.targFirst = 0;
  // through all the rest of them
  cTmp.partCount = -1;
  // box extent:  +/- 1.0 box at origin
  var boxLen = 20.0;
  cTmp.xMin = -boxLen; cTmp.xMax = boxLen;
  cTmp.yMin = -2 * boxLen; cTmp.yMax = 2 * boxLen;
  cTmp.zMin = 0 * boxLen; cTmp.zMax = boxLen;
  // bouncyness: coeff. of restitution.
  cTmp.Kresti = 0.9;
  // (and IGNORE all other CLimit members...)
  // append this to array of constraint-causing objects
  this.limitList.push(cTmp);

  // Report:
  console.log("PartSys.Cloth() created PartSys.limitList[] array of ");
  console.log("\t\t", this.limitList.length, "CLimit objects.");
  for (i = 0; i < this.limitList.length; i++) {
    console.log("CLimitList[", i, "]");
    this.limitList[i].printMe();
  }




  // initial velocity in meters/sec.
  // adjust by ++Start, --Start buttons. Original value 
  // was 0.15 meters per timestep; multiply by 60 to get meters per second.
  this.INIT_VEL = 0.15 * 60.0;

  // units-free air-drag (scales velocity); adjust by d/D keys
  this.drag = 0.985;
  // gravity's acceleration(meter/sec^2); adjust by g/G keys
  this.grav = 9.832;
  // units-free 'Coefficient of Restitution'
  this.resti = 0.9;




  // Initialize Particle System Controls:

  // Master Control: 0=reset; 1= pause; 2=step; 3=run
  this.runMode = 3;
  // adjust by s/S keys
  this.solvType = SOLV_MIDPOINT;
  // this.solvType = SolverSelected.solvType;//Solver.Euler;//Midpoint;
  // floor-bounce constraint type:
  // ==0 for velocity-reversal, as in all previous versions
  // ==1 for Chapter 3's collision resolution method, which uses
  // an 'impulse' to cancel any velocity boost caused by falling below the floor
  this.bounceType = 1;




  // Create and fill VBO with state s1 contents:

  // i = particle number; j = array index for i-th particle
  var j = 0;
  for (var j1 = 0; j1 < count; j1++) {
    this.s1[j + PART_XPOS] = 1.5 * (j1 - 0.5);
    this.s1[j + PART_YPOS] = 0.0;
    this.s1[j + PART_ZPOS] = 5.0;
    this.s1[j + PART_WPOS] = 1.0;
    // harcoded velocities for now
    this.s1[j + PART_XVEL] = 0.0;
    this.s1[j + PART_YVEL] = 0.0;
    this.s1[j + PART_ZVEL] = 0.0;

    // mass, in kg.
    this.s1[j + PART_MASS] = 1.0;
    // on-screen diameter, in pixels (not used as of now for spring system)
    this.s1[j + PART_DIAM] = 2.0 + 10 * Math.random();
    this.s1[j + PART_RENDMODE] = 0.0;
    this.s1[j + PART_AGE] = 30 + 100 * Math.random();

    j += PART_MAXVAR;
  }


  // COPY contents of state-vector s1 to s2
  this.s2.set(this.s1);




}
PartSys.prototype.initSpringRope = function (count) {
  //==============================================================================
  console.log('PartSys.initSpringRope() stub not finished!');
}
PartSys.prototype.initSpringCloth = function (xSiz, ySiz) {
  //==============================================================================
  console.log('PartSys.initSpringCloth() stub not finished!');
}
PartSys.prototype.initSpringSolid = function () {
  //==============================================================================
  console.log('PartSys.initSpringSolid() stub not finished!');
}
PartSys.prototype.initOrbits = function () {
  //==============================================================================
  console.log('PartSys.initOrbits() stub not finished!');
}

PartSys.prototype.applyForces = function (s, fList) {
  //==============================================================================
  // Clear the force-accumulator vector for each particle in state-vector 's', 
  // then apply each force described in the collection of force-applying objects 
  // found in 'fSet'.
  // (this function will simplify our too-complicated 'draw()' function)

  // To begin, CLEAR force-accumulators for all particles in state variable 's'
  var j = 0;  // i==particle number; j==array index for i-th particle
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    s[j + PART_X_FTOT] = 0.0;
    s[j + PART_Y_FTOT] = 0.0;
    s[j + PART_Z_FTOT] = 0.0;
  }
  // then find and accumulate all forces applied to particles in state s:
  for (var k = 0; k < fList.length; k++) {  // for every CForcer in fList array,
    //    console.log("fList[k].forceType:", fList[k].forceType);
    if (fList[k].forceType <= 0) {     //.................Invalid force? SKIP IT!
      // if forceType is F_NONE, or if forceType was 
      continue;         // negated to (temporarily) disable the CForcer,
    }
    // ..................................Set up loop for all targeted particles
    // HOW THIS WORKS:
    // Most, but not all CForcer objects apply a force to many particles, and
    // the CForcer members 'targFirst' and 'targCount' tell us which ones:
    // *IF* targCount == 0, the CForcer applies ONLY to particle numbers e1,e2
    //          (e.g. the e1 particle begins at s[fList[k].e1 * PART_MAXVAR])
    // *IF* targCount < 0, apply the CForcer to 'targFirst' and all the rest
    //      of the particles that follow it in the state variable s.
    // *IF* targCount > 0, apply the CForcer to exactly 'targCount' particles,
    //      starting with particle number 'targFirst'
    // Begin by presuming targCount < 0;
    var m = fList[k].targFirst;   // first affected particle # in our state 's'
    var mmax = this.partCount;    // Total number of particles in 's'
    // (last particle number we access is mmax-1)
    if (fList[k].targCount == 0) {    // ! Apply force to e1,e2 particles only!
      m = mmax = 0;   // don't let loop run; apply force to e1,e2 particles only.
    }
    else if (fList[k].targCount > 0) {   // ?did CForcer say HOW MANY particles?
      // YES! force applies to 'targCount' particles starting with particle # m:
      var tmp = fList[k].targCount;
      if (tmp < mmax) mmax = tmp;    // (but MAKE SURE mmax doesn't get larger)
      else console.log("\n\n!!PartSys.applyForces() index error!!\n\n");
    }
    //console.log("m:",m,"mmax:",mmax);
    // m and mmax are now correctly initialized; use them!  
    //......................................Apply force specified by forceType 
    switch (fList[k].forceType) {    // what kind of force should we apply?
      case F_MOUSE:     // Spring-like connection to mouse cursor
        console.log("PartSys.applyForces(), fList[", k, "].forceType:",
          fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_GRAV_E:    // Earth-gravity pulls 'downwards' as defined by downDir
        var j = m * PART_MAXVAR;  // state var array index for particle # m
        for (; m < mmax; m++, j += PART_MAXVAR) { // for every part# from m to mmax-1,
          // force from gravity == mass * gravConst * downDirection
          s[j + PART_X_FTOT] += s[j + PART_MASS] * fList[k].gravConst *
            fList[k].downDir.elements[0];
          s[j + PART_Y_FTOT] += s[j + PART_MASS] * fList[k].gravConst *
            fList[k].downDir.elements[1];
          s[j + PART_Z_FTOT] += s[j + PART_MASS] * fList[k].gravConst *
            fList[k].downDir.elements[2];
        }
        break;
      case F_GRAV_P:    // planetary gravity between particle # e1 and e2.
        console.log("PartSys.applyForces(), fList[", k, "].forceType:",
          fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_WIND:      // Blowing-wind-like force-field; fcn of 3D position
        var j = m * PART_MAXVAR;
        for (; m < mmax; m++, j += PART_MAXVAR) {

        }
        break;
      case F_BUBBLE:    // Constant inward force (bub_force)to a 3D centerpoint 
        // bub_ctr if particle is > bub_radius away from it.
        console.log("PartSys.applyForces(), fList[", k, "].forceType:",
          fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_DRAG:      // viscous drag: force = -K_drag * velocity.
        var j = m * PART_MAXVAR;  // state var array index for particle # m
        for (; m < mmax; m++, j += PART_MAXVAR) { // for every particle# from m to mmax-1,
          // force from gravity == mass * gravConst * downDirection
          s[j + PART_X_FTOT] -= fList[k].K_drag * s[j + PART_XVEL];
          s[j + PART_Y_FTOT] -= fList[k].K_drag * s[j + PART_YVEL];
          s[j + PART_Z_FTOT] -= fList[k].K_drag * s[j + PART_ZVEL];
        }
        break;
      case F_SPRING:
        var k1 = fList[k].e1;
        var k2 = fList[k].e2;
        var j1 = k1 * PART_MAXVAR;
        var j2 = k2 * PART_MAXVAR;
        // force from spring = K_spring * (length change)
        // distance from spring center:
        var del_x = (s[j1 + PART_XPOS] - s[j2 + PART_XPOS]);
        var del_y = (s[j1 + PART_YPOS] - s[j2 + PART_YPOS]);
        var del_z = (s[j1 + PART_ZPOS] - s[j2 + PART_ZPOS]);

        // current spring length (dist between the two particles)
        var del_len = Math.sqrt(del_x * del_x + del_y * del_y + del_z * del_z);
        // Normalize del (direction of spring deformation)
        var del_len_inv = 1 / del_len;
        del_x *= del_len_inv;
        del_y *= del_len_inv;
        del_z *= del_len_inv;

        // veloctiy of deformation:
        // it is difference in the velocities of the two particles
        // at both ends of the spring
        // But only the velocity components parallel to the spring
        // would contribute for spring velocity
        vel_spring_x = s[j1 + PART_XVEL] - s[j2 + PART_XVEL];
        vel_spring_y = s[j1 + PART_YVEL] - s[j2 + PART_YVEL];
        vel_spring_z = s[j1 + PART_ZVEL] - s[j2 + PART_ZVEL];

        // get the magnitude as that is required to calculate the spring damping
        //vel_spring = vel1_spring - vel2_spring;


        var deltaLen = fList[k].K_restLength - del_len;
        // force from spring = K_spring * (length change)
        // also apply spring damping

        s[j1 + PART_X_FTOT] += (fList[k].K_spring * (deltaLen * del_x)
          - (fList[k].K_springDamp * vel_spring_x));
        s[j1 + PART_Y_FTOT] += (fList[k].K_spring * (deltaLen * del_y)
          - (fList[k].K_springDamp * vel_spring_y));
        s[j1 + PART_Z_FTOT] += (fList[k].K_spring * (deltaLen * del_z)
          - (fList[k].K_springDamp * vel_spring_z));

        s[j2 + PART_X_FTOT] -= (fList[k].K_spring * (deltaLen * del_x)
          - (fList[k].K_springDamp * vel_spring_x));
        s[j2 + PART_Y_FTOT] -= (fList[k].K_spring * (deltaLen * del_y)
          - (fList[k].K_springDamp * vel_spring_y));
        s[j2 + PART_Z_FTOT] -= (fList[k].K_spring * (deltaLen * del_z)
          - (fList[k].K_springDamp * vel_spring_z));


        break;
      case F_SPRINGSET:
        console.log("PartSys.applyForces(), fList[", k, "].forceType:",
          fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_CHARGE:
        console.log("PartSys.applyForces(), fList[", k, "].forceType:",
          fList[k].forceType, "NOT YET IMPLEMENTED!!");
        break;
      case F_BOIDS:
        fList[k].boidForce(s, this.flockNb, m, mmax, this.scalingBoid, this.obstPos);
        break;
      case F_TORNADO:

        //*********################# *************################### ****** * /
        gravityForce = function (pOff, s1, s0) {
          s1[pOff + PART_Z_FTOT] = -2.832 / s0[pOff + PART_MASS];
        }
        // ** Next, we calculate the tangent forces which will make it circular, then add forces that pull the particles in, and finally adds a z force that increases as we get further from the center:
        tangentForce = function (pOff, s1, s0) {        //Tangent Forces, with .9 as the center
          s1[pOff + PART_X_FTOT] = (1.9 - s1[pOff + PART_YPOS]);
          s1[pOff + PART_Y_FTOT] = -(1.9 - s1[pOff + PART_XPOS]);         //Forces to pull the particles in.  Decrease as Z increases
          s1[pOff + PART_X_FTOT] += 6 * (2.8 - s1[pOff + PART_ZPOS]) * (1.9 - s1[pOff + PART_XPOS]);
          s1[pOff + PART_Y_FTOT] += 6 * (2.8 - s1[pOff + PART_ZPOS]) * (1.9 - s1[pOff + PART_YPOS]);
          //Force that pushes the particles up. Increases as distances from the center point of
          //(.9,.9,.2) increases.
          s1[pOff + PART_Z_FTOT] += 15 * (Math.abs(1.9 - s1[pOff + PART_XPOS])) + 10 * (.2 -
            s1[pOff + PART_ZPOS]) + 15 * (Math.abs(1.9 - s0[pOff + PART_YPOS]));
        }
        //This calculate the drag force, keeping the particles from going crazy.  
        dragForce = function (pOff, s1) {
          s1[pOff + PART_X_FTOT] -= (0.45 * 0.15 * 3.14 * s1[pOff + PART_DIAM] * s1[pOff + PART_XVEL] / 2);
          s1[pOff + PART_Y_FTOT] -= (0.45 * 0.15 * 3.14 * s1[pOff + PART_DIAM] * s1[pOff + PART_YVEL] / 2);
          s1[pOff + PART_Z_FTOT] -= (0.45 * 0.15 * 3.14 * s1[pOff + PART_DIAM] * s1[pOff + PART_ZVEL] / 2);
        }
        var j = m * PART_MAXVAR;  // state var array index for particle # m
        for (; m < mmax; m++, j += PART_MAXVAR) { // for every part# from m to mmax-1,
          // force from gravity == mass * gravConst * downDirection
          gravityForce(j, s, this.s2);
          tangentForce(j, s, this.s2);
          dragForce(j, s);
        }
        break;
      default:
        console.log("!!!ApplyForces() fList[", k, "] invalid forceType:", fList[k].forceType);
        break;
    } // switch(fList[k].forceType)
  } // for(k=0...)
}

PartSys.prototype.dotFinder = function (dest, src) {
  //==============================================================================
  // fill the already-existing 'dest' variable (a float32array) with the 
  // time-derivative of given state 'src'.  

  var invMass;  // inverse mass
  var j = 0;  // i==particle number; j==array index for i-th particle
  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
    dest[j + PART_XPOS] = src[j + PART_XVEL];   // position derivative = velocity
    dest[j + PART_YPOS] = src[j + PART_YVEL];
    dest[j + PART_ZPOS] = src[j + PART_ZVEL];
    dest[j + PART_WPOS] = 0.0;                  // presume 'w' fixed at 1.0
    // Use 'src' current force-accumulator's values (set by PartSys.applyForces())
    // to find acceleration.  As multiply is FAR faster than divide, do this:
    invMass = 1.0 / src[j + PART_MASS];   // F=ma, so a = F/m, or a = F(1/m);
    dest[j + PART_XVEL] = src[j + PART_X_FTOT] * invMass;
    dest[j + PART_YVEL] = src[j + PART_Y_FTOT] * invMass;
    dest[j + PART_ZVEL] = src[j + PART_Z_FTOT] * invMass;
    dest[j + PART_X_FTOT] = 0.0;  // we don't know how force changes with time;
    dest[j + PART_Y_FTOT] = 0.0;  // presume it stays constant during timestep.
    dest[j + PART_Z_FTOT] = 0.0;
    dest[j + PART_R] = 0.0;       // presume color doesn't change with time.
    dest[j + PART_G] = 0.0;
    dest[j + PART_B] = 0.0;
    dest[j + PART_MASS] = 0.0;    // presume mass doesn't change with time.
    dest[j + PART_DIAM] = 0.0;    // presume these don't change either...   
    dest[j + PART_RENDMODE] = 0.0;
    dest[j + PART_AGE] = 0.0;
  }
}

PartSys.prototype.render = function (s) {
  //==============================================================================

  gl.bufferSubData(
    gl.ARRAY_BUFFER,
    0, this.s1); // Float32Array data source.

  gl.uniform1i(this.u_runModeID, this.runMode);	// run/step/pause the particle system 

  // gl.drawArrays(gl.POINTS, 0, this.partCount);    // draw this many vertices.
}

PartSys.prototype.solver = function () {
  //==============================================================================
  // Find next state s2 from current state s1 (and perhaps some related states
  // such as s1dot, sM, sMdot, etc.) by the numerical integration method chosen
  // by PartSys.solvType.

  switch (this.solvType) {
    case SOLV_EULER://--------------------------------------------------------
      // EXPLICIT or 'forward time' solver; Euler Method: s2 = s1 + h*s1dot
      for (var n = 0; n < this.s1.length; n++) { // for all elements in s1,s2,s1dot;
        this.s2[n] = this.s1[n] + this.s1dot[n] * (g_timeStep * 0.001);
      }
      break;
    case SOLV_OLDGOOD://-------------------------------------------------------------------
      // IMPLICIT or 'reverse time' solver, as found in bouncyBall04.goodMKS;
      // This category of solver is often better, more stable, but lossy.
      // -- apply acceleration due to gravity to current velocity:
      //				  s2[PART_YVEL] -= (accel. due to gravity)*(g_timestep in seconds) 
      //                  -= (9.832 meters/sec^2) * (g_timeStep/1000.0);
      var j = 0;  // i==particle number; j==array index for i-th particle
      for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
        this.s2[j + PART_YVEL] -= this.grav * (g_timeStep * 0.001);
        // -- apply drag: attenuate current velocity:
        this.s2[j + PART_XVEL] *= this.drag;
        this.s2[j + PART_YVEL] *= this.drag;
        this.s2[j + PART_ZVEL] *= this.drag;
        // -- move our particle using current velocity:
        // CAREFUL! must convert g_timeStep from milliseconds to seconds!
        this.s2[j + PART_XPOS] += this.s2[j + PART_XVEL] * (g_timeStep * 0.001);
        this.s2[j + PART_YPOS] += this.s2[j + PART_YVEL] * (g_timeStep * 0.001);
        this.s2[j + PART_ZPOS] += this.s2[j + PART_ZVEL] * (g_timeStep * 0.001);
      }
      // What's the result of this rearrangement?
      //	IT WORKS BEAUTIFULLY! much more stable much more often...
      break;
    case SOLV_MIDPOINT:         // Midpoint Method (see lecture notes)
      for (var n = 0; n < this.s1.length; n++) {
        this.sM[n] = this.s1[n] + this.s1dot[n] * (g_timeStep / 2.0 * 0.001);
      }
      // now calculate sMdot using dotFinder
      this.dotFinder(this.sMdot, this.sM);
      // now get s2 with full-step
      for (var n = 0; n < this.s1.length; n++) {
        this.s2[n] = this.s1[n] + this.sMdot[n] * (g_timeStep * 0.001);
      }
      //console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;

    case SOLV_ADAMS_BASH:       // Adams-Bashforth Explicit Integrator
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_RUNGEKUTTA:       // Arbitrary degree, set by 'solvDegree'
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_BACK_EULER:       // 'Backwind' or Implicit Euler
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_BACK_MIDPT:      // 'Backwind' or Implicit Midpoint
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_BACK_ADBASH:      // 'Backwind' or Implicit Adams-Bashforth
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_VERLET:          // Verlet semi-implicit integrator;
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    case SOLV_VEL_VERLET:      // 'Velocity-Verlet'semi-implicit integrator
      var j = 0;
      for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
        var h = (g_timeStep * 0.001);
        invMass = 1.0;


        this.s2[j + PART_XPOS] = this.s1[j + PART_XPOS] + this.s1[j + PART_XVEL] * h + invMass * this.s1[j + PART_X_FTOT] * (0.5 * h * h);
        this.s2[j + PART_YPOS] = this.s1[j + PART_YPOS] + this.s1[j + PART_YVEL] * h + invMass * this.s1[j + PART_Y_FTOT] * (0.5 * h * h);
        this.s2[j + PART_ZPOS] = this.s1[j + PART_ZPOS] + this.s1[j + PART_ZVEL] * h + invMass * this.s1[j + PART_Z_FTOT] * (0.5 * h * h);

        this.s2[j + PART_WPOS] = 1.0;


        this.applyForces(this.s2, this.forceList);


        this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL] + invMass * (this.s1[j + PART_X_FTOT] + this.s2[j + PART_X_FTOT]) * (0.5 * h);
        this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL] + invMass * (this.s1[j + PART_Y_FTOT] + this.s2[j + PART_Y_FTOT]) * (0.5 * h);
        this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL] + invMass * (this.s1[j + PART_Z_FTOT] + this.s2[j + PART_Z_FTOT]) * (0.5 * h);
      }
      break;
    case SOLV_LEAPFROG:        // 'Leapfrog' integrator
      console.log('NOT YET IMPLEMENTED: this.solvType==' + this.solvType);
      break;
    default:
      console.log('?!?! unknown solver: this.solvType==' + this.solvType);
      break;
  }
  return;
}

PartSys.prototype.doConstraints = function (sNow, sNext, cList) {
  //==============================================================================

  if (this.bounceType == 0) { //------------------------------------------------
    var j = 0;  // i==particle number; j==array index for i-th particle
    for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
      // simple velocity-reversal: 
      if (this.s2[j + PART_XPOS] < -0.9 && this.s2[j + PART_XVEL] < 0.0) {
        // bounce on left (-X) wall
        this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL];
      }
      else if (this.s2[j + PART_XPOS] > 0.9 && this.s2[j + PART_XVEL] > 0.0) {
        // bounce on right (+X) wall
        this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL];
      } //---------------------------
      if (this.s2[j + PART_YPOS] < -0.9 && this.s2[j + PART_YVEL] < 0.0) {
        // bounce on floor (-Y)
        this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
      }
      else if (this.s2[j + PART_YPOS] > 0.9 && this.s2[j + PART_YVEL] > 0.0) {
        // bounce on ceiling (+Y)
        this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL];
      } //---------------------------
      if (this.s2[j + PART_ZPOS] < -0.9 && this.s2[j + PART_ZVEL] < 0.0) {
        // bounce on near wall (-Z)
        this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
      }
      else if (this.s2[j + PART_ZPOS] > 0.9 && this.s2[j + PART_ZVEL] > 0.0) {
        // bounce on far wall (+Z)
        this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL];
      }
      //--------------------------
      // The above constraints change ONLY the velocity; nothing explicitly
      // forces the bouncy-ball to stay within the walls. If we begin with a
      // bouncy-ball on floor with zero velocity, gravity will cause it to 'fall' 
      // through the floor during the next timestep.  At the end of that timestep
      // our velocity-only constraint will scale velocity by -this.resti, but its
      // position is still below the floor!  Worse, the resti-weakened upward 
      // velocity will get cancelled by the new downward velocity added by gravity 
      // during the NEXT time-step. This gives the ball a net downwards velocity 
      // again, which again gets multiplied by -this.resti to make a slight upwards
      // velocity, but with the ball even further below the floor. As this cycle
      // repeats, the ball slowly sinks further and further downwards.
      // THUS the floor needs this position-enforcing constraint as well:
      if (this.s2[j + PART_YPOS] < -0.9) this.s2[j + PART_YPOS] = -0.9;
      else if (this.s2[j + PART_YPOS] > 0.9) this.s2[j + PART_YPOS] = 0.9; // ceiling
      if (this.s2[j + PART_XPOS] < -0.9) this.s2[j + PART_XPOS] = -0.9; // left wall
      else if (this.s2[j + PART_XPOS] > 0.9) this.s2[j + PART_XPOS] = 0.9; // right wall
      if (this.s2[j + PART_ZPOS] < -0.9) this.s2[j + PART_ZPOS] = -0.9; // near wall
      else if (this.s2[j + PART_ZPOS] > 0.9) this.s2[j + PART_ZPOS] = 0.9; // far wall
      // Our simple 'bouncy-ball' particle system needs this position-limiting
      // constraint ONLY for the floor and not the walls, as no forces exist that
      // could 'push' a zero-velocity particle against the wall. But suppose we
      // have a 'blowing wind' force that pushes particles left or right? Any
      // particle that comes to rest against our left or right wall could be
      // slowly 'pushed' through that wall as well -- THUS we need position-limiting
      // constraints for ALL the walls:
    } // end of for-loop thru all particles
  } // end of 'if' for bounceType==0
  else if (this.bounceType == 1) {
    //-----------------------------------------------------------------
    var j = 0;  // i==particle number; j==array index for i-th particle
    for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {
      //--------  left (-X) wall  ----------
      if (this.s2[j + PART_XPOS] < -0.9) {// && this.s2[j + PART_XVEL] < 0.0 ) {
        // collision!
        this.s2[j + PART_XPOS] = -0.9;// 1) resolve contact: put particle at wall.
        this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];  // 2a) undo velocity change:
        this.s2[j + PART_XVEL] *= this.drag;	            // 2b) apply drag:
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE!
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision. 
        if (this.s2[j + PART_XVEL] < 0.0)
          this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_XVEL] = this.resti * this.s2[j + PART_XVEL]; // sign changed-- don't need another.
      }
      //--------  right (+X) wall  --------------------------------------------
      else if (this.s2[j + PART_XPOS] > 0.9) { // && this.s2[j + PART_XVEL] > 0.0) {	
        // collision!
        this.s2[j + PART_XPOS] = 0.9; // 1) resolve contact: put particle at wall.
        this.s2[j + PART_XVEL] = this.s1[j + PART_XVEL];	// 2a) undo velocity change:
        this.s2[j + PART_XVEL] *= this.drag;			        // 2b) apply drag:
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE! 
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision. 
        if (this.s2[j + PART_XVEL] > 0.0)
          this.s2[j + PART_XVEL] = -this.resti * this.s2[j + PART_XVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_XVEL] = this.resti * this.s2[j + PART_XVEL];	// sign changed-- don't need another.
      }
      //--------  floor (-Y) wall  --------------------------------------------  		
      if (this.s2[j + PART_YPOS] < -0.9) { // && this.s2[j + PART_YVEL] < 0.0) {		
        // collision! floor...  
        this.s2[j + PART_YPOS] = -0.9;// 1) resolve contact: put particle at wall.
        this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
        this.s2[j + PART_YVEL] *= this.drag;		          // 2b) apply drag:	
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE!
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision.
        if (this.s2[j + PART_YVEL] < 0.0)
          this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_YVEL] = this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
      }
      //--------  ceiling (+Y) wall  ------------------------------------------
      else if (this.s2[j + PART_YPOS] > 0.9) { // && this.s2[j + PART_YVEL] > 0.0) {
        // collision! ceiling...
        this.s2[j + PART_YPOS] = 0.9;// 1) resolve contact: put particle at wall.
        this.s2[j + PART_YVEL] = this.s1[j + PART_YVEL];	// 2a) undo velocity change:
        this.s2[j + PART_YVEL] *= this.drag;			        // 2b) apply drag:
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE!
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision.
        if (this.s2[j + PART_YVEL] > 0.0)
          this.s2[j + PART_YVEL] = -this.resti * this.s2[j + PART_YVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_YVEL] = this.resti * this.s2[j + PART_YVEL];	// sign changed-- don't need another.
      }
      //--------  near (-Z) wall  --------------------------------------------- 
      if (this.s2[j + PART_ZPOS] < -0.9) { // && this.s2[j + PART_ZVEL] < 0.0 ) {
        // collision! 
        this.s2[j + PART_ZPOS] = -0.9;// 1) resolve contact: put particle at wall.
        this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
        this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision. 
        if (this.s2[j + PART_ZVEL] < 0.0)
          this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_ZVEL] = this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
      }
      //--------  far (+Z) wall  ---------------------------------------------- 
      else if (this.s2[j + PART_ZPOS] > 0.9) { // && this.s2[j + PART_ZVEL] > 0.0) {	
        // collision! 
        this.s2[j + PART_ZPOS] = 0.9; // 1) resolve contact: put particle at wall.
        this.s2[j + PART_ZVEL] = this.s1[j + PART_ZVEL];  // 2a) undo velocity change:
        this.s2[j + PART_ZVEL] *= this.drag;			        // 2b) apply drag:
        // 3) BOUNCE:  reversed velocity*coeff-of-restitution.
        // ATTENTION! VERY SUBTLE PROBLEM HERE! ------------------------------
        // need a velocity-sign test here that ensures the 'bounce' step will 
        // always send the ball outwards, away from its wall or floor collision.   			
        if (this.s2[j + PART_ZVEL] > 0.0)
          this.s2[j + PART_ZVEL] = -this.resti * this.s2[j + PART_ZVEL]; // need sign change--bounce!
        else
          this.s2[j + PART_ZVEL] = this.resti * this.s2[j + PART_ZVEL];	// sign changed-- don't need another.
      } // end of (+Z) wall constraint
    } // end of for-loop for all particles
  } // end of bounceType==1 
  else {
    console.log('?!?! unknown constraint: PartSys.bounceType==' + this.bounceType);
    return;
  }

  //-----------------------------add 'age' constraint:
  if (this.isTornado == true)    // When particle age falls to zero, re-initialize
    // i==particle number; j==array index for i-th particle
    var j = 0;


  for (var i = 0; i < this.partCount; i += 1, j += PART_MAXVAR) {

    // decrement lifetime
    this.s2[j + PART_AGE] -= 1;
    this.s2[j + PART_DIAM] -= 0.05;
    this.s2[j + PART_MASS] -= 0.05;

    // End of life: RESET this particle!
    if (this.s2[j + PART_AGE] <= 0) {
      // set this.randX,randY,randZ to random location in
      // a 3D unit sphere centered at the origin
      this.roundRand();
      // all our bouncy-balls stay within a +/- 0.9 cube centered at origin; 
      // set random positions in a 0.1-radius ball centered at (0.8,0.8,0.8)
      this.s2[j + PART_ZPOS] = 1.5 + 2.0 * this.randZ;
      this.s2[j + PART_XPOS] = 0.0 + (this.s2[PART_ZPOS] + 2.0) * this.randX;
      this.s2[j + PART_YPOS] = 0.0 + (this.s2[PART_ZPOS] + 2.0) * this.randY;
      this.s2[j + PART_WPOS] = 1.0;

      // Now choose random initial velocities too:
      this.roundRand();
      this.s2[j + PART_XVEL] = 0;//this.INIT_VEL*(0.2*this.randX);
      this.s2[j + PART_YVEL] = 0;//this.INIT_VEL*(0.2*this.randY);
      this.s2[j + PART_ZVEL] = 0;//this.INIT_VEL*(0.2);// + 0.2*this.randZ);

      // mass, in kg.
      this.s2[j + PART_MASS] = 1.0;
      // on-screen diameter, in pixels
      this.s2[j + PART_DIAM] = 2.0 + 10 * Math.random();
      this.s2[j + PART_RENDMODE] = 0.0;
      this.s2[j + PART_AGE] = 15 + 5 * Math.random();
    }
  }
}

PartSys.prototype.step = function () {
  //==============================================================================
  // Choose the method you want:

  // We can EXCHANGE, actually step the contents of s1 and s2, like this:  
  // but !! YOU PROBABLY DON'T WANT TO DO THIS !!
  /*
    var tmp = this.s1;
    this.s1 = this.s2;
    this.s2 = tmp;
  */

  // Or we can REPLACE s1 contents with s2 contents, like this:
  // NOTE: if we try:  this.s1 = this.s2; we DISCARD s1's memory!!

  this.s1.set(this.s2);     // set values of s1 array to match s2 array.
  // (WHY? so that your solver can make intermittent changes to particle
  // values without any unwanted 'old' values re-appearing. For example,
  // At timestep 36, particle 11 had 'red' color in s1, and your solver changes
  // its color to blue in s2, but makes no further changes.  If step() EXCHANGES 
  // s1 and s2 contents, on timestep 37 the particle is blue, but on timestep 38
  // the particle is red again!  If we REPLACE s1 contents with s2 contents, the
  // particle is red at time step 36, but blue for 37, 38, 39 and all further
  // timesteps until we change it again.
  // REPLACE s1 contents with s2 contents:
}


PartSys.prototype.mvpTornado = function () {

  var mvpMat = new Matrix4();
  mvpMat.setIdentity();
  mvpMat.rotate(90, 0.0, 0, -1);
  mvpMat.translate(3.0, 15.0, 0);
  mvpMat.scale(0.5, 0.5, 0.5);

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);


  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
    0,                  // index: start at this vertex in the VBO;
    this.partCount);    // draw this many vertices.
}


PartSys.prototype.mvpFire = function () {


  var mvpMat = new Matrix4();
  mvpMat.setIdentity();
  mvpMat.rotate(180, 0, 0, -1);
  mvpMat.translate(2.5, -0.5, 0);
  mvpMat.scale(0.2, 0.2, 0.1);

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);


  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
    0,                  // index: start at this vertex in the VBO;
    this.partCount);    // draw this many vertices.

}

PartSys.prototype.mvpBoids = function () {


  var mvpMat = new Matrix4();
  mvpMat.setIdentity();
  mvpMat.rotate(90, 0.0, 0, -1);
  mvpMat.translate(3.0, 10.0, 1.5);
  mvpMat.scale(0.3, 0.3, 0.3);

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);


  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
    0,                  // index: start at this vertex in the VBO;
    this.partCount);    // draw this many vertices.

}

PartSys.prototype.mvpSprings = function () {


  var mvpMat = new Matrix4();
  mvpMat.setIdentity();
  mvpMat.rotate(90, 0.0, 0, -1);
  mvpMat.translate(-1.8, 3.0, 0);

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);


  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
    0,                  // index: start at this vertex in the VBO;
    this.partCount);    // draw this many vertices.

}

PartSys.prototype.mvpBouncyballs = function () {


  var mvpMat = new Matrix4();
  mvpMat.setIdentity();
  // mvpMat.rotate(90, 1.0, 0, -1);
  mvpMat.translate(1.5, -0.8, 0);
  mvpMat.scale(0.8, 0.8, 0.8);
  mvpMat.rotate(90, 1.0, 0, 0);

  gl.uniformMatrix4fv(u_mvpMat_loc, false, mvpMat.elements);


  // Draw our VBO's new contents:
  gl.drawArrays(gl.POINTS,          // mode: WebGL drawing primitive to use 
    0,                  // index: start at this vertex in the VBO;
    this.partCount);    // draw this many vertices.

}

PartSys.prototype.mvpGroundGrid = function () {




}


