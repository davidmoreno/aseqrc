import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

console.log("Render", document.getElementById("main"), React)

ReactDOM.render(
    <App/>,
    document.getElementById("main"),
)
