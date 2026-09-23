//// Puppet Pin Null Creator (0.5), Carlos Albarrán, basado en código de Liam Hill
//// Este script crea un nulo asociado a cada uno de los puntos de puppet de una malla y los emparenta en orden jerárquico.
////
////  VARIABLES GLOBALES
////**************************************************************************************
var activeItem = app.project.activeItem;
var selectedLayers = activeItem.selectedLayers;
////**************************************************************************************

//// CÓDIGO PRINCIPAL
////**************************************************************************************
////
// Esta parte se asegura de que tenemos una composición seleccionada
if (activeItem == null || !(activeItem instanceof CompItem))
 {
  alert("¡Tienes que seleccionar una composición!");
 }
else
 {	
	// Aquí nos aseguramos de que la composición tenga una maya de Puppet Pin
	if (selectedLayers[0] == null || selectedLayers[0].effect.puppet == null)
	{
		alert("¡La capa que has seleccionado no tiene una malla de puppet!");
	}
	else
	{
		app.beginUndoGroup("Create Puppet Nulls");
		
		// Aquí guardamos el número de mayas de Puppet que hay en nuestra composición
		var numMesh = selectedLayers[0].property("ADBE Effect Parade")
		.property("ADBE FreePin3").property("ADBE FreePin3 ARAP Group")
		.property("ADBE FreePin3 Mesh Group").numProperties;
		
		// Array 2D para guardar todos los puntos de puppet
		var meshAndPins = new Array(numMesh);
		
		// Código a repetir por cada maya de puppet
		for (var t = 1; t <= numMesh; t++)
		{
			// Nombre de nuestro mesh
			var whatMesh = selectedLayers[0].property("Effects")
			.property("Puppet").property("arap").property("Mesh").property(t).name;
		
			 //Guardamos cómo acceder a los puntos de puppet de esta malla
			var thePins = selectedLayers[0].property("Effects").property("Puppet")
			.property("arap").property("Mesh").property(whatMesh).property("Deform");
		
			// Cuantos puntos de puppet hay en esta maya
			var allTheProps = thePins.numProperties;
             var previousNull = null;
			
			// Aplica los controladores a todos los puntos de puppet
			for (var n = allTheProps; n >= 1; n--)
				{
					var pin = thePins.property(n);
                      myNull = activeItem.layers.addNull();
                      myNull.anchorPoint.setValue([50,50]);			
                      myNull.name = selectedLayers[0].name+ " " +pin.propertyGroup(2).name + " " + pin.name;		 
                      myNull.inPoint = selectedLayers[0].inPoint;
                      myNull.outPoint = selectedLayers[0].outPoint;
                      myNull.shy = true;
                      myNull.scale.setValue([50,50]);
                      //Para no tener que hacer space transforms, hacemos los nulos hijos de la capa donde están los puntos de puppet
                      myNull.parent = selectedLayers[0];
                      //Centramos el nulo en el punto de puppet
                      myNull.position.setValue(pin.position.value);
                      //Comprobamos si el punto de puppet es el primero, y si no, lo emparentamos al punto anterior
                      if(previousNull != null){
                          myNull.parent = previousNull;
                          }
                      //Aplicamos la expresión para que el puppet pin siga a nuestro nulo
                      pin.position.expression = "p=thisComp.layer(\"" + myNull.name + "\"); fromComp(p.toComp(p.anchorPoint))";
                      previousNull = myNull;
				}         
		}
	 app.endUndoGroup();
	}
 }
////**************************************************************************************