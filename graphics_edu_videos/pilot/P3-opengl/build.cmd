@echo off
rem Build p3gl.exe with MSVC (x64). Needs VS 2026 (v145).
set VSROOT=D:\Program Files\Microsoft Visual Studio\18\Community
call "%VSROOT%\VC\Auxiliary\Build\vcvars64.bat" >nul
set REPO=%~dp0..\..\..
if not exist "%~dp0build" mkdir "%~dp0build"
cd /d "%~dp0build"
cl /nologo /O2 /EHsc /std:c++20 /MD /utf-8 /I"%REPO%\shared_lib_include\include" /I"%~dp0." "%~dp0p3gl.cpp" "%REPO%\source_core\vsproj\LearnOpenGL\share\glad.c" /Fe:p3gl.exe /link /LIBPATH:"%REPO%\shared_lib_include\lib" glfw3.lib opengl32.lib user32.lib gdi32.lib shell32.lib
