partially fixed bug in src\extensions\renderer\base\coord-ele-math\labels.js
 switch( textHalign ){
    case 'left':
      textX = nodePos.x - nodeWidth / 2 - padding;

and in src\extensions\renderer\canvas\drawing-label-text.js
 if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
   // then it's already ok, so skip all the other ifs
 } else if( halign === 'left' ){ // auto justification : right
+  context.textAlign= 'left';
   if( justification === 'left' ){
      textX += -textW;

fixed by adding line that starts with +
