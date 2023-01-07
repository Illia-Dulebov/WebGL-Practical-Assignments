"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

let inputValue = 0.0;

let scaleU = 0.0;
let scaleV = 0.0;
let scaleValue = 1;

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
  this.iTextureBuffer = gl.createBuffer();
  this.iPointVertexBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals, texCoords) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iPointVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);    

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.uniform1i(shProgram.iDrawPoint, false);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.vertexAttribPointer(shProgram.iNormalVertex, 3, gl.FLOAT, true, 0, 0);
    gl.enableVertexAttribArray(shProgram.iNormalVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.vertexAttribPointer(shProgram.iTextureCoords, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iTextureCoords);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);

    gl.uniform1i(shProgram.iDrawPoint, true);

    gl.uniform3fv(shProgram.iScalePointWorldLocation, [xFunction(scaleU, scaleV), yFunction(scaleU, scaleV), zFunction(scaleU, scaleV)]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
 
    gl.drawArrays(gl.POINTS, 0, 1);
  };
}

// Constructor
function ShaderProgram(name, program) {
 
  this.name = name;
  this.prog = program;

  this.iAttribVertex = -1;
  this.iNormalVertex = -1;
  this.iTextureCoords = -1;

  this.iColor = -1;

  this.iModelViewProjectionMatrix = -1;
  this.iWorldMatrix = -1;
  this.iWorldInverseTranspose = -1;

  this.iLightWorldPosition = -1;
  this.iLightDirection = -1;

  this.iViewWorldPosition = -1;

  this.iTexture = -1;

  this.iScalePointLocation = -1;
  this.iScaleValue = -1;

  this.iDrawPoint = -1;

  this.iScalePointWorldLocation = -1;
 
  this.Use = function() {
      gl.useProgram(this.prog);
  }
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);

  // Enable the depth buffer
  gl.enable(gl.DEPTH_TEST);
  
  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI/4, 1, 4, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let WorldMatrix = m4.translation(0, 0, -10);

  let matAccum1 = m4.multiply(WorldMatrix, modelView );
  let modelViewProjection = m4.multiply(projection, matAccum1 );

  var worldInverseMatrix = m4.inverse(matAccum1);
  var worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

  gl.uniform3fv(shProgram.iViewWorldPosition, [0, 0, 0]); 

  gl.uniform3fv(shProgram.iLightWorldPosition, LineSig());
  gl.uniform3fv(shProgram.iLightDirection, [0, -1, 0]);

  gl.uniformMatrix4fv(shProgram.iWorldInverseTranspose, false, worldInverseTransposeMatrix);
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
  gl.uniformMatrix4fv(shProgram.iWorldMatrix, false, matAccum1 );
  
  gl.uniform4fv(shProgram.iColor, [0.5,0.5,0.5,1] );

  gl.uniform2fv(shProgram.iScalePointLocation, [scaleU / 360.0, scaleV / 90.0] );
  gl.uniform1f(shProgram.iScaleValue, scaleValue);

  gl.uniform1i(shProgram.iTexture, 0);
  
  surface.Draw();
}

//Creating data as vertices for surface
function CreateSurfaceData() {
  let vertices = [];
  let normals = [];
  let textCoords = [];

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

      textCoords.push(j / n, v1);
      textCoords.push( j + 1 / n, v1);
    }
  }

  return [vertices, normals, textCoords];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
  shProgram.iNormalVertex              = gl.getAttribLocation(prog, "normal");
  shProgram.iTextureCoords             = gl.getAttribLocation(prog, "texcoord");
  
  shProgram.iColor                     = gl.getUniformLocation(prog, "color");

  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
  shProgram.iWorldInverseTranspose     = gl.getUniformLocation(prog, "WorldInverseTranspose");
  shProgram.iWorldMatrix               = gl.getUniformLocation(prog, "WorldMatrix");

  shProgram.iLightWorldPosition        = gl.getUniformLocation(prog, "LightWorldPosition");
  shProgram.iLightDirection            = gl.getUniformLocation(prog, "LightDirection");

  shProgram.iViewWorldPosition         = gl.getUniformLocation(prog, "ViewWorldPosition");
  
  shProgram.iTexture                   = gl.getUniformLocation(prog, "u_texture");

  shProgram.iScalePointLocation        = gl.getUniformLocation(prog, "ScalePointLocation");
  shProgram.iScaleValue                = gl.getUniformLocation(prog, "ScaleValue");
  
  shProgram.iDrawPoint                 = gl.getUniformLocation(prog, "bDrawpoint");

  shProgram.iScalePointWorldLocation   = gl.getUniformLocation(prog, "ScalePointWorldLocation");

  surface = new Model('Surface');
  surface.BufferData(CreateSurfaceData()[0], CreateSurfaceData()[1], CreateSurfaceData()[2]);

  //gl.enable(gl.DEPTH_TEST);
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

  LoadTexture();
}

window.addEventListener("keydown", function (event) {  
  switch (event.key) {
    case "ArrowLeft":
      ProcessArrowLeftDown();
      break;
    case "ArrowRight":
      ProcessArrowRightDown();
      break;
      case "W":
          ProcessWDown();
          break;
      case "w":
          ProcessWDown();
          break;
      case "S":
          ProcessSDown();
          break;
      case "s":
          ProcessSDown();
          break;
      case "A":
          ProcessADown();
          break;
      case "a":
          ProcessADown();
          break;
      case "D":
          ProcessDDown();
          break;
      case "d":
          ProcessDDown();
          break;
      case "+":
          ProcessPlusDown();
          break;
      case "-":
          ProcessSubtractDown();
          break;
    default:
          break; 
  }

  draw();
});

function ProcessArrowLeftDown() {
  InputCounter -= 0.05;
}

function ProcessArrowRightDown() {
  InputCounter += 0.05;
}

function LoadTexture() {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));
 
    var image = new Image();
    image.crossOrigin = "anonymous"
    image.src = "https://i1.photo.2gis.com/images/profile/30258560049997155_fe3f.jpg";
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);

        console.log("Texture is loaded!");

        draw();
    });
}

function ProcessWDown() {
    scaleV -= 5.0;
    scaleV = clamp(scaleV, 0.0, 90);
}

function ProcessSDown() {
    scaleV += 5.0;
    scaleV = clamp(scaleV, 0.0, 90);
}

function ProcessADown() {
    scaleU -= 5.0;
    scaleU = clamp(scaleU, 0.0, 360);
}

function ProcessDDown() {
    scaleU += 5.0;
    scaleU = clamp(scaleU, 0.0, 360);
}

function ProcessPlusDown() {
    scaleValue += 0.05;
    scaleValue = clamp(scaleValue, 0.5, 2.0);
}

function ProcessSubtractDown() {
    scaleValue -= 0.05;
    scaleValue = clamp(scaleValue, 0.5, 2.0);
}

function clamp(value, min, max) {
    if(value < min)
    {
        value = min
    }
    else if(value > max)
    {
        value = max;
    }

    return value;
}



function LineSig() {
  return [inputValue, 20, -1 * inputValue * 10];
}
