# Prints a greeting
function(greet name)
  message(STATUS "Hello ${name}")
endfunction()

set(GREETING "hi")
