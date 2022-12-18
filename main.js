"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

let inputValue = 0.0;

const r = parseFloat(1.0);
const a = parseFloat(0.5);
const n = parseInt(300);

const uDel = 0.001;
const vDel = 0.001;

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

function URestrictions(u) {
  return u * Math.PI * 12;
}

function VRestrictions(v) {
  return v * Math.PI * 2;
}

function xFunction(v, u) {
  return (
    (r + a * Math.cos(u / 2)) * Math.cos(u / 3) +
    a * Math.cos(u / 3) * Math.cos(v - Math.PI)
  );
}

function yFunction(v, u) {
  return (
    (r + a * Math.cos(u / 2)) * Math.sin(u / 3) +
    a * Math.sin(u / 3) * Math.cos(v - Math.PI)
  );
}

function zFunction(v, u) {
  return a + Math.sin(u / 2) + a * Math.sin(v - Math.PI);
}

function derUFunc(u, v, uDelta) {
  let x = xFunction(u, v);
  let y = yFunction(u, v);
  let z = zFunction(u, v);

  let Dx = xFunction(u + uDelta, v);
  let Dy = yFunction(u + uDelta, v);
  let Dz = zFunction(u + uDelta, v);

  let Dxdu = (Dx - x) / deg2rad(uDelta);
  let Dydu = (Dy - y) / deg2rad(uDelta);
  let Dzdu = (Dz - z) / deg2rad(uDelta);

  return [Dxdu, Dydu, Dzdu];
}

function derVFunc(u, v, vDelta) {
  let x = xFunction(u, v);
  let y = yFunction(u, v);
  let z = zFunction(u, v);

  let Dx = xFunction(u, v + vDelta);
  let Dy = yFunction(u, v + vDelta);
  let Dz = zFunction(u, v + vDelta);

  let Dxdv = (Dx - x) / deg2rad(vDelta);
  let Dydv = (Dy - y) / deg2rad(vDelta);
  let Dzdv = (Dz - z) / deg2rad(vDelta);

  return [Dxdv, Dydv, Dzdv];
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iNormalBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.vertexAttribPointer(shProgram.iNormalVertex, 3, gl.FLOAT, true, 0, 0);
    gl.enableVertexAttribArray(shProgram.iNormalVertex);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  };
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.iNormalVertex = -1;

  this.iWorldMatrix = -1;
  this.iWorldInverseTranspose = -1;

  this.iLightWorldPosition = -1;
  this.iLightDirection = -1;

  this.iViewWorldPosition = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 4, 1, 4, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum1 = m4.multiply(translateToPointZero, modelView);

  /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);

  var worldInverseMatrix = m4.inverse(matAccum1);
  var worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

  gl.uniform3fv(shProgram.iViewWorldPosition, [0, 0, 0]);

  gl.uniform3fv(shProgram.iLightWorldPosition, LineSig());
  gl.uniform3fv(shProgram.iLightDirection, [0, -1, 0]);

  gl.uniformMatrix4fv(shProgram.iWorldInverseTranspose, false, worldInverseTransposeMatrix);
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false,modelViewProjection);
  gl.uniformMatrix4fv(shProgram.iWorldMatrix, false, matAccum1);

  /* Draw the six faces of a cube, with different colors. */
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

  surface.Draw();
}

//Creating data as vertices for surface
function CreateSurfaceData() {
  let vertices = [];
  let normals = [];

  for (let j = 0; j <= n; j += 1) {
    let u1 = j / n;

    for (let i = 0; i <= n; i += 1) {
      let v1 = i / n;
      let u = URestrictions(u1);
      let v = VRestrictions(v1);

      let x = xFunction(v, u);
      let y = yFunction(v, u);
      let z = zFunction(v, u);

      vertices.push(x, y, z); 

      x = xFunction(v, u + 1);
      y = yFunction(v, u + 1);
      z = zFunction(v, u + 1);

      vertices.push(x, y, z); 

      let derU = derUFunc(u, v, uDel);
      let derV = derVFunc(u, v, vDel);

      let result = m4.cross(derV, derU);
      normals.push(result[0]);
      normals.push(result[1]);
      normals.push(result[2]);

      derU = derUFunc(u + 1, v, uDel);
      derV = derVFunc(u + 1, v, vDel);

      result = m4.cross(derV, derU);
      normals.push(result[0]);
      normals.push(result[1]);
      normals.push(result[2]);
    }
  }

  return [vertices, normals];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Basic", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");

  shProgram.iNormalVertex = gl.getAttribLocation(prog, "normal");

  shProgram.iColor = gl.getUniformLocation(prog, "color");

  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");

  shProgram.iWorldInverseTranspose = gl.getUniformLocation(prog, "WorldInverseTranspose");
  shProgram.iWorldMatrix = gl.getUniformLocation(prog, "WorldMatrix");
  shProgram.iLightWorldPosition = gl.getUniformLocation(prog, "LightWorldPosition");
  shProgram.iLightDirection = gl.getUniformLocation(prog, "LightDirection");
  shProgram.iViewWorldPosition = gl.getUniformLocation(prog, "ViewWorldPosition");

  surface = new Model("Surface");
  surface.BufferData(CreateSurfaceData()[0], CreateSurfaceData()[1]);

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  draw();
}

window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "ArrowLeft":
        inputValue -= 1;
        draw();
      break;
    case "ArrowRight":
        inputValue += 1;
        draw();
      break;
    default:
      return;
  }
});

function LineSig() {
  return [inputValue, 20, -1 * inputValue * 10];
}
