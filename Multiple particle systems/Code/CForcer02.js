/*
================================================================================
================================================================================

                              CForcer Library

================================================================================
================================================================================
  Each object of type 'CForcer' fully describe just one force-causing entity in 
our particle system (e.g. gravity, drag, wind force, a spring, a boid force, 
electrical charge, interactive user input, etc), and we make an array of these
objects inside each particle-system object (e.g. PartSys.forceList[]) and use 
only the CForcer objects in that array in the 'PartSys.applyForces()' function.  
  Each 'CForcer' object contains a 'forceType' member variable whose value 
selects the kind of force that the object describes, where: */
// ---------------forceType values----------------
const F_NONE = 0;      // Non-existent force: ignore this CForcer object
// NOTE: any forceType value < 0 causes LIM_NONE result; THUS you can
//      ***negate forceType*** to temporarily disable a CForcer object.
//      (quite useful for debugging  and for novel user controls...)   
const F_MOUSE = 1;      // Spring-like connection to the mouse cursor; lets
// you 'grab' and 'wiggle' one or more particles.
const F_GRAV_E = 2;      // Earth-gravity: pulls all particles 'downward'.
const F_GRAV_P = 3;      // Planetary-gravity; particle-pair (e1,e2) attract
// each other with force== grav* mass1*mass2/ dist^2
const F_WIND = 4;      // Blowing-wind-like force-field;fcn of 3D position
const F_BUBBLE = 5;      // Constant inward force towards a 3D centerpoint if
// particle is > max_radius away from centerpoint.
const F_DRAG = 6;      // Viscous drag -- force = -K_drag * velocity.
const F_SPRING = 7;      // ties together 2 particles; distance sets force
const F_SPRINGSET = 8;      // a big collection of identical springs; lets you
// make cloth & rubbery shapes as one force-making
// object, instead of many many F_SPRING objects.
const F_CHARGE = 9;      // attract/repel by charge and inverse distance.
const F_MAXKINDS = 10;      // 'max' is always the LAST name in our list;
// gives the total number of choices for forces.
const F_TORNADO = 11;

const F_BOIDS = 12;

/* NOTE THAT different forceType values (e.g. gravity vs spring) will need 
different parameters inside CForcer to describe their forces.  For example, a 
CForcer object for planetary gravity will need a gravitational constant 'grav'; 
a CForcer object for a spring will need a spring constant, damping constant, and 
the state-variable index of the 2 particles it connects, and so forth.  
For simplicity, we don't 'customize' CForcer objects with different member vars;
instead, each CForcer each contains all the member variables needed for any 
possible forceType value, but we simply ignore the member vars we don't need. 
*/
//=============================================================================
//==============================================================================
function CForcer() {
  //==============================================================================
  //=============================================================================
  // Constructor for a new 'forcer' applied-force object
  this.forceType = F_NONE;   // initially no force at all.

  this.targFirst = 0;       // particle-number (count from 0 in state variable)
  // of the first particle affected by this CForcer;
  this.targCount = -1;      // Number of sequential particles in state variable
  // affected by this CForcer object. To select ALL 
  // particles from 'targFirst' on, set targCount < 0.
  // For springs, set targCount=0 & use e1,e2 below.

  // F_GRAV_E  Earth Gravity variables........................................
  this.gravConst = 9.832;   // gravity's acceleration(meter/sec^2); 
  // on Earth surface, value is 9.832 meters/sec^2.
  this.downDir = new Vector4([0, 0, -1, 1]); // 'down' direction vector for gravity.

  // F_GRAV_P  Planetary Gravity variables....................................
  // Attractive force on a pair of particles (e1,e2) with strength of
  // F = gravConst * mass1 * mass2 / dist^2.
  // Re-uses 'gravConst' from Earth gravity,
  this.planetDiam = 10.0;   // Minimum-possible separation distance for e1,e2;
  // avoids near-infinite forces when planets collide.

  // F_DRAG Viscous Drag Variables............................................
  this.K_drag = 0.15;       // force = -velocity*K_drag.

  this.K_wind = 0.0;
  // (in Euler solver, which assumes constant force
  // during each timestep, drag of 0.15 multiplies
  // s1 velocity by (1-0.15)==0.85)

  // F_BUBBLE Bubble-force variables:.........................................
  this.bub_radius = 1.0;                   // bubble radius
  this.bub_ctr = new Vector4(0, 0, 0, 1);     // bubble's center point position
  this.bub_force = 1.0;      // inward-force's strength when outside the bubble

  // F_SPRING Single Spring variables;........................................
  this.e1 = 0;               // Spring endpoints connect particle # e1 to # e2
  this.e2 = 1;               // (state vars hold particles 0,1,2,3,...partCount)
  this.K_spring = 0.5;;             // Spring constant: force = stretchDistance*K_s
  this.K_springDamp = 0.5;         // Spring damping: (friction within the spring);
  // force = -relVel*K_damp; 'relative velocity' is
  // how fast the spring length is changing, and
  // applied along the direction of the spring.
  this.K_restLength = 2.0;         // the zero-force length of this spring.

  // Tornado
  this.TornadoCenter = new Vector4([0, 0, 1, 0]);

  this.tornadoRadius = 8.0;
  this.tornadoHeight = 30.0;
}

CForcer.prototype.printMe = function (opt_src) {
  //==============================================================================
  // Print relevant contents of a given CForcer object.
  if (opt_src && typeof opt_src === 'string') {
    console.log("------------CForcer ", name, ":----------");
  }
  else {
    console.log("------------CForcer Contents:----------");
  }

  console.log("targFirst:", this.targFirst, "targCount:", this.targCount);
  var tmp = this.forceType;
  if (tmp < 0) {
    console.log("forceType ***NEGATED***; CForcer object temporarily disabled!");
    tmp = -tmp;     // reverse sign so we can display the force type:
  }
  switch (tmp) {
    case F_NONE:
      console.log("forceType: F_NONE");
      break;
    case F_MOUSE:
      console.log("forceType: F_MOUSE");
      break;
    case F_GRAV_E:
      console.log("forceType: F_GRAV_E. gravConst:", this.gravConst);
      this.downDir.printMe("downDir vector:");
      break;
    case F_GRAV_P:
      console.log("forceType: F_GRAV_P. gravConst:", this.gravConst);
      console.log("e1, e2 particle numbers:", this.e1, ", ", this.e2,
        "planetDiam (min e1,e2 distance):", this.planetDiam);
      break;
    case F_WIND:
      console.log("forceType: F_WIND.");
      break;
    case F_BUBBLE:
      console.log("forceType: F_BUBBLE. bub_radius:", this.bub_radius,
        "bub_force:", this.bub_force);
      this.bub_ctr.printMe("bub_ctr:");
      console
      break;
    case F_DRAG:
      console.log("forceType: F_DRAG. K_drag:", this.K_drag);
      break;
    case F_SPRING:
      console.log("forceType: F_SPRING.");
      console.log("e1, e2 particle numbers:", this.e1, ", ", this.e2);
      console.log("\tK_spring:", this.K_spring,
        "\tK_springDamp:", this.K_springDamp,
        "\tK_restLength:", this.K_restLength);
      break;
    case F_SPRINGSET:
      console.log("forceType: F_SPRINGSET.");
      break;
    case F_CHARGE:
      console.log("forceType: F_CHARGE.");
      break;
    case F_TORNADO:
      console.log("forceType: F_GRAV_E. gravConst:", this.gravConst);
      this.downDir.printMe("downDir vector:");
      break;
    default:
      console.log("forceType: invalid value:", this.forceType);
      break;
  }
  console.log("..........................................");

}

CForcer.prototype.boidForce = function (s, flockNeighbourhood, mStart, mEnd, scaling, objPos) {
  // var flockNeighbourhood = {
  //     Cohesive: flockNbCohesive,
  //     Repulsive: flockNbRepulsive,
  //     Velocity: flockNbVelocity,
  //     Obstacle: flockNbObstacle,
  // }

  var scaling1 = scaling.Cohesive;
  var scaling2 = scaling.Repulsive;
  var scaling3 = scaling.Velocity;
  var scaling4 = scaling.Obstacle;

  var fNb1 = flockNeighbourhood.Cohesive;
  var fNb2 = flockNeighbourhood.Repulsive;
  var fNb3 = flockNeighbourhood.Velocity;
  var fNb4 = flockNeighbourhood.Obstacle;

  var j = mStart * PART_MAXVAR;  // state var array index for particle # m
  for (var m = mStart; m < mEnd; m++, j += PART_MAXVAR) {
    // rule 1: steer towards centre of mass
    //console.log("current mJ: " + m);
    var del_F1 = this.ruleSteerTowards(s, fNb1, m, mStart, mEnd, scaling1);

    // rule 2: steer away from neighbouring particles
    var del_F2 = this.ruleSteerAway(s, fNb2, m, mStart, mEnd, scaling2);

    // rule 3: make velocity closer to average neighbourhood velocity
    var del_F3 = this.matchVelocity(s, fNb3, m, mStart, mEnd, scaling3);

    // rule 4: move particles away from obstacle
    var del_F3 = this.ruleSteerAwayObject(s, fNb4, m, mStart, mEnd, scaling4, objPos);

    // apply the forces as a net flocking force
    var del_F_x = del_F1.x + del_F2.x + del_F3.x;
    var del_F_y = del_F1.y + del_F2.y + del_F3.y;
    var del_F_z = del_F1.z + del_F2.z + del_F3.z;

    s[j + PART_X_FTOT] += del_F_x;
    s[j + PART_Y_FTOT] += del_F_y;
    s[j + PART_Z_FTOT] += del_F_z;
  }
}


CForcer.prototype.ruleSteerTowards = function (s, flockNeighbourhood, mJ, mStart, mEnd, scaling) {
  // inside the neighbourhood:
  // calculate the centroid
  var cen_x = 0;
  var cen_y = 0;
  var cen_z = 0;

  var j = mStart * PART_MAXVAR;
  var i1 = mJ * PART_MAXVAR;
  var curr_x = s[i1 + PART_XPOS];
  var curr_y = s[i1 + PART_YPOS];
  var curr_z = s[i1 + PART_ZPOS];

  var nbCount = 0;

  for (m = mStart; m < mEnd; m++, j += PART_MAXVAR) {

    var i2 = m * PART_MAXVAR;

    var diff_x = Math.pow(curr_x - s[i2 + PART_XPOS], 2);
    var diff_y = Math.pow(curr_y - s[i2 + PART_YPOS], 2);
    var diff_z = Math.pow(curr_z - s[i2 + PART_ZPOS], 2);
    var fNb = Math.pow(flockNeighbourhood, 2);

    if ((diff_x + diff_y + diff_z) <= fNb) {
      if (m != mJ) {
        cen_x = cen_x + s[i2 + PART_XPOS];
        cen_y = cen_y + s[i2 + PART_YPOS];
        cen_z = cen_z + s[i2 + PART_ZPOS];

        nbCount = nbCount + 1;
      }
    }
  }

  if (nbCount == 0) {
    cen_x = curr_x;
    cen_y = curr_y;
    cen_z = curr_z;
  }
  else {
    cen_x = cen_x / nbCount;
    cen_y = cen_y / nbCount;
    cen_z = cen_z / nbCount;
  }

  // calculate distance of our particle from centroid
  var Fx = (cen_x - curr_x) * scaling;
  var Fy = (cen_y - curr_y) * scaling;
  var Fz = (cen_z - curr_z) * scaling;

  return {
    x: Fx,
    y: Fy,
    z: Fz,
  }
}

CForcer.prototype.ruleSteerAway = function (s, flockNeighbourhood, mJ, mStart, mEnd, scaling) {
  // inside the neighbourhood:
  // calculate the centroid
  var cen_x = 0;
  var cen_y = 0;
  var cen_z = 0;

  var j = mStart * PART_MAXVAR;
  var i1 = mJ * PART_MAXVAR;
  var curr_x = s[i1 + PART_XPOS];
  var curr_y = s[i1 + PART_YPOS];
  var curr_z = s[i1 + PART_ZPOS];

  var nbCount = 0;

  for (m = mStart; m < mEnd; m++, j += PART_MAXVAR) {

    var i2 = m * PART_MAXVAR;

    var diff_x = Math.pow(curr_x - s[i2 + PART_XPOS], 2);
    var diff_y = Math.pow(curr_y - s[i2 + PART_YPOS], 2);
    var diff_z = Math.pow(curr_z - s[i2 + PART_ZPOS], 2);
    var fNb = Math.pow(flockNeighbourhood, 2);

    if ((diff_x + diff_y + diff_z) <= fNb) {
      if (m != mJ) {
        cen_x = cen_x + s[i2 + PART_XPOS];
        cen_y = cen_y + s[i2 + PART_YPOS];
        cen_z = cen_z + s[i2 + PART_ZPOS];

        nbCount = nbCount + 1;
      }
    }
  }

  if (nbCount == 0) {
    cen_x = curr_x;
    cen_y = curr_y;
    cen_z = curr_z;
  }
  else {
    cen_x = cen_x / nbCount;
    cen_y = cen_y / nbCount;
    cen_z = cen_z / nbCount;
  }

  // calculate distance of our particle from centroid
  // apply that displacement in the opposite direction
  var Fx = -(cen_x - curr_x) * scaling;
  var Fy = -(cen_y - curr_y) * scaling;
  var Fz = -(cen_z - curr_z) * scaling;

  return {
    x: Fx,
    y: Fy,
    z: Fz,
  }
}

CForcer.prototype.matchVelocity = function (s, flockNeighbourhood, mJ, mStart, mEnd, scaling) {
  // inside the neighbourhood:
  // calculate the average velocity of the flock in neighbourhood
  // inside the neighbourhood:
  // calculate the centroid
  var vAvg_x = 0;
  var vAvg_y = 0;
  var vAvg_z = 0;

  var j = mStart * PART_MAXVAR;
  var i1 = mJ * PART_MAXVAR;

  var vCurr_x = s[i1 + PART_XVEL];
  var vCurr_y = s[i1 + PART_YVEL];
  var vCurr_z = s[i1 + PART_ZVEL];

  var curr_x = s[i1 + PART_XPOS];
  var curr_y = s[i1 + PART_YPOS];
  var curr_z = s[i1 + PART_ZPOS];

  var nbCount = 0;

  for (m = mStart; m < mEnd; m++, j += PART_MAXVAR) {

    var i2 = m * PART_MAXVAR;

    var diff_x = Math.pow(curr_x - s[i2 + PART_XPOS], 2);
    var diff_y = Math.pow(curr_y - s[i2 + PART_YPOS], 2);
    var diff_z = Math.pow(curr_z - s[i2 + PART_ZPOS], 2);
    var fNb = Math.pow(flockNeighbourhood, 2);

    if ((diff_x + diff_y + diff_z) <= fNb) {
      if (m != mJ) {
        vAvg_x = vAvg_x + s[i2 + PART_XVEL];
        vAvg_y = vAvg_y + s[i2 + PART_YVEL];
        vAvg_z = vAvg_z + s[i2 + PART_ZVEL];

        nbCount = nbCount + 1;
      }
    }
  }

  if (nbCount == 0) {
    vAvg_x = vCurr_x;
    vAvg_y = vCurr_y;
    vAvg_z = vCurr_z;
  }
  else {
    vAvg_x = vAvg_x / nbCount;
    vAvg_y = vAvg_y / nbCount;
    vAvg_z = vAvg_z / nbCount;
  }



  // calculate distance of our particle from centroid
  // apply that displacement in the opposite direction
  var Fx = (vAvg_x - vCurr_x) * scaling;
  var Fy = (vAvg_y - vCurr_y) * scaling;
  var Fz = (vAvg_z - vCurr_z) * scaling;

  return {
    x: Fx,
    y: Fy,
    z: Fz,
  }
  // make our velocity closer to this velocity
  // we can do that by accelerating in the direction of the velocity

}

CForcer.prototype.ruleSteerAwayObject = function (s, flockNeighbourhood, mJ, mStart, mEnd, scaling, objPosition) {
  // inside the neighbourhood:
  // calculate the centroid
  var cen_x = objPosition.x;
  var cen_y = objPosition.y;
  var cen_z = objPosition.z;

  var i1 = mJ * PART_MAXVAR;
  var curr_x = s[i1 + PART_XPOS];
  var curr_y = s[i1 + PART_YPOS];
  var curr_z = s[i1 + PART_ZPOS];

  // calculate distance of our particle from object
  // apply that displacement in the opposite direction
  var Fx = -(cen_x - curr_x) * scaling;
  var Fy = -(cen_y - curr_y) * scaling;
  var Fz = -(cen_z - curr_z) * scaling;

  return {
    x: Fx,
    y: Fy,
    z: Fz,
  }
}