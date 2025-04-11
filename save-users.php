<?php
// Permitir solicitudes CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// Verificar si es una solicitud POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Obtener el contenido JSON de la solicitud
    $json = file_get_contents('php://input');
    
    // Verificar si el JSON es válido
    $data = json_decode($json);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(["error" => "JSON inválido"]);
        exit;
    }
    
    // Guardar el JSON en el archivo users.json
    if (file_put_contents('users.json', $json)) {
        http_response_code(200);
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "No se pudo guardar el archivo"]);
    }
} else {
    http_response_code(405);
    echo json_encode(["error" => "Método no permitido"]);
}
?> 