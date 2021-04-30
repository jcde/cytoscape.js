import * as util from '../../../util';
import * as math from '../../../math';

let CRp = {};

CRp.eleTextBiggerThanMin = function( ele, scale ){
  if( !scale ){
    let zoom = ele.cy().zoom();
    let pxRatio = this.getPixelRatio();
    let lvl = Math.ceil( math.log2( zoom * pxRatio ) ); // the effective texture level

    scale = Math.pow( 2, lvl );
  }

  let computedSize = ele.pstyle( 'font-size' ).pfValue * scale;
  let minSize = ele.pstyle( 'min-zoomed-font-size' ).pfValue;

  if( computedSize < minSize ){
    return false;
  }

  return true;
};

CRp.drawElementText = function( context, ele, shiftToOriginWithBb, force, prefix, useEleOpacity = true ){
  let r = this;

  if( force == null ){
    if( useEleOpacity && !r.eleTextBiggerThanMin( ele ) ){ return; }
  } else if( force === false ){
    return;
  }

  if( ele.isNode() ){
    let label = ele.pstyle( 'label' );

    if( !label || !label.value ){ return; }

    let justification = r.getLabelJustification(ele);

    context.textAlign = justification;
    context.textBaseline = 'bottom';
  } else {
    let badLine = ele.element()._private.rscratch.badLine;
    let label = ele.pstyle( 'label' );
    let srcLabel = ele.pstyle( 'source-label' );
    let tgtLabel = ele.pstyle( 'target-label' );

    if(
      badLine || (
        ( !label || !label.value )
        && ( !srcLabel || !srcLabel.value )
        && ( !tgtLabel || !tgtLabel.value )
      )
    ){
      return;
    }

    context.textAlign = 'center';
    context.textBaseline = 'bottom';
  }

  let applyRotation = !shiftToOriginWithBb;

  let bb;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  if( prefix == null ){
    r.drawText( context, ele, null, applyRotation, useEleOpacity );

    if( ele.isEdge() ){
      r.drawText( context, ele, 'source', applyRotation, useEleOpacity );

      r.drawText( context, ele, 'target', applyRotation, useEleOpacity );
    }
  } else {
    r.drawText( context, ele, prefix, applyRotation, useEleOpacity );
  }

  if( shiftToOriginWithBb ){
    context.translate( bb.x1, bb.y1 );
  }
};

CRp.getFontCache = function( context ){
  let cache;

  this.fontCaches = this.fontCaches || [];

  for( let i = 0; i < this.fontCaches.length; i++ ){
    cache = this.fontCaches[ i ];

    if( cache.context === context ){
      return cache;
    }
  }

  cache = {
    context: context
  };
  this.fontCaches.push( cache );

  return cache;
};

// set up canvas context with font
// returns transformed text string
CRp.setupTextStyle = function( context, ele, useEleOpacity = true ){
  // Font style
  let labelStyle = ele.pstyle( 'font-style' ).strValue;
  let labelSize = ele.pstyle( 'font-size' ).pfValue + 'px';
  let labelFamily = ele.pstyle( 'font-family' ).strValue;
  let labelWeight = ele.pstyle( 'font-weight' ).strValue;
  let opacity = (useEleOpacity ? ele.effectiveOpacity() * ele.pstyle('text-opacity').value : 1);
  let outlineOpacity = ele.pstyle( 'text-outline-opacity' ).value * opacity;
  let color = ele.pstyle( 'color' ).value;
  let outlineColor = ele.pstyle( 'text-outline-color' ).value;

  context.font = labelStyle + ' ' + labelWeight + ' ' + labelSize + ' ' + labelFamily;

  context.lineJoin = 'round'; // so text outlines aren't jagged

  this.colorFillStyle( context, color[ 0 ], color[ 1 ], color[ 2 ], opacity );

  this.colorStrokeStyle( context, outlineColor[ 0 ], outlineColor[ 1 ], outlineColor[ 2 ], outlineOpacity );
};

// TODO ensure re-used
function roundRect( ctx, x, y, width, height, radius = 5 ){
  ctx.beginPath();
  ctx.moveTo( x + radius, y );
  ctx.lineTo( x + width - radius, y );
  ctx.quadraticCurveTo( x + width, y, x + width, y + radius );
  ctx.lineTo( x + width, y + height - radius );
  ctx.quadraticCurveTo( x + width, y + height, x + width - radius, y + height );
  ctx.lineTo( x + radius, y + height );
  ctx.quadraticCurveTo( x, y + height, x, y + height - radius );
  ctx.lineTo( x, y + radius );
  ctx.quadraticCurveTo( x, y, x + radius, y );
  ctx.closePath();
  ctx.fill();
}

CRp.getTextAngle = function( ele, prefix ){
  let theta;
  let _p = ele._private;
  let rscratch = _p.rscratch;
  let pdash = prefix ? prefix + '-' : '';
  let rotation = ele.pstyle( pdash + 'text-rotation' );
  let textAngle = util.getPrefixedProperty( rscratch, 'labelAngle', prefix );

  if( rotation.strValue === 'autorotate' ){
    theta = ele.isEdge() ? textAngle : 0;
  } else if( rotation.strValue === 'none' ){
    theta = 0;
  } else {
    theta = rotation.pfValue;
  }

  return theta;
};

CRp.drawText = function( context, ele, prefix, applyRotation = true, useEleOpacity = true ){
  let _p = ele._private;
  let rscratch = _p.rscratch;
  let parentOpacity = useEleOpacity ? ele.effectiveOpacity() : 1;

  if( useEleOpacity && (parentOpacity === 0 || ele.pstyle( 'text-opacity' ).value === 0) ){
    return;
  }

  // use 'main' as an alias for the main label (i.e. null prefix)
  if( prefix === 'main' ){ prefix = null; }

  let textX = util.getPrefixedProperty( rscratch, 'labelX', prefix );
  let textY = util.getPrefixedProperty( rscratch, 'labelY', prefix );
  let orgTextX, orgTextY; // used for rotation
  let text = this.getLabelText( ele, prefix );

  if( text != null && text !== '' && !isNaN( textX ) && !isNaN( textY ) ){
    this.setupTextStyle( context, ele, useEleOpacity );

    let pdash = prefix ? prefix + '-' : '';
    let textW = util.getPrefixedProperty( rscratch, 'labelWidth', prefix );
    let textH = util.getPrefixedProperty( rscratch, 'labelHeight', prefix );
    let marginX = ele.pstyle( pdash + 'text-margin-x' ).pfValue;
    let marginY = ele.pstyle( pdash + 'text-margin-y' ).pfValue;

    let isEdge = ele.isEdge();

    let halign = ele.pstyle( 'text-halign' ).value;
    let valign = ele.pstyle( 'text-valign' ).value;

    if( isEdge ){
      halign = 'center';
      valign = 'center';
    }

    textX += marginX;
    textY += marginY;

    let theta;

    if( !applyRotation ){
      theta = 0;
    } else {
      theta = this.getTextAngle(ele, prefix);
    }

    if( theta !== 0 ){
      orgTextX = textX;
      orgTextY = textY;

      context.translate( orgTextX, orgTextY );
      context.rotate( theta );

      textX = 0;
      textY = 0;
    }

    switch( valign ){
      case 'top':
        break;
      case 'center':
        textY += textH / 2;
        break;
      case 'bottom':
        textY += textH;
        break;
    }

    let backgroundOpacity = ele.pstyle( 'text-background-opacity' ).value;
    let borderOpacity = ele.pstyle( 'text-border-opacity' ).value;
    let textBorderWidth = ele.pstyle( 'text-border-width' ).pfValue;
    let backgroundPadding = ele.pstyle( 'text-background-padding' ).pfValue;

    if( backgroundOpacity > 0 || ( textBorderWidth > 0 && borderOpacity > 0 ) ){
      let bgX = textX - backgroundPadding;

      switch( halign ){
        case 'left':
          bgX -= textW;
          break;
        case 'center':
          bgX -= textW / 2;
          break;
        case 'right':
          break;
      }

      let bgY = textY - textH - backgroundPadding;
      let bgW = textW + 2*backgroundPadding;
      let bgH = textH + 2*backgroundPadding;

      if( backgroundOpacity > 0 ){
        let textFill = context.fillStyle;
        let textBackgroundColor = ele.pstyle( 'text-background-color' ).value;

        context.fillStyle = 'rgba(' + textBackgroundColor[ 0 ] + ',' + textBackgroundColor[ 1 ] + ',' + textBackgroundColor[ 2 ] + ',' + backgroundOpacity * parentOpacity + ')';
        let styleShape = ele.pstyle( 'text-background-shape' ).strValue;
        if( styleShape.indexOf('round') === 0 ){
          roundRect( context, bgX, bgY, bgW, bgH, 2 );
        } else {
          context.fillRect( bgX, bgY, bgW, bgH );
        }
        context.fillStyle = textFill;
      }

      if( textBorderWidth > 0 && borderOpacity > 0 ){
        let textStroke = context.strokeStyle;
        let textLineWidth = context.lineWidth;
        let textBorderColor = ele.pstyle( 'text-border-color' ).value;
        let textBorderStyle = ele.pstyle( 'text-border-style' ).value;

        context.strokeStyle = 'rgba(' + textBorderColor[ 0 ] + ',' + textBorderColor[ 1 ] + ',' + textBorderColor[ 2 ] + ',' + borderOpacity * parentOpacity + ')';
        context.lineWidth = textBorderWidth;

        if( context.setLineDash ){ // for very outofdate browsers
          switch( textBorderStyle ){
            case 'dotted':
              context.setLineDash( [ 1, 1 ] );
              break;
            case 'dashed':
              context.setLineDash( [ 4, 2 ] );
              break;
            case 'double':
              context.lineWidth = textBorderWidth / 4; // 50% reserved for white between the two borders
              context.setLineDash( [] );
              break;
            case 'solid':
              context.setLineDash( [] );
              break;
          }
        }

        context.strokeRect( bgX, bgY, bgW, bgH );

        if( textBorderStyle === 'double' ){
          let whiteWidth = textBorderWidth / 2;

          context.strokeRect( bgX + whiteWidth, bgY + whiteWidth, bgW - whiteWidth * 2, bgH - whiteWidth * 2 );
        }

        if( context.setLineDash ){ // for very outofdate browsers
          context.setLineDash( [] );
        }
        context.lineWidth = textLineWidth;
        context.strokeStyle = textStroke;
      }

    }

    let lineWidth = 2 * ele.pstyle( 'text-outline-width' ).pfValue; // *2 b/c the stroke is drawn centred on the middle

    if( lineWidth > 0 ){
      context.lineWidth = lineWidth;
    }

    if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
      let lines = util.getPrefixedProperty( rscratch, 'labelWrapCachedLines', prefix );
      let lineHeight = util.getPrefixedProperty( rscratch, 'labelLineHeight', prefix );
      let halfTextW = textW/2;
      let justification = this.getLabelJustification(ele);

      if( justification === 'auto' ){
        // then it's already ok, so skip all the other ifs
      } else if( halign === 'left' ){ // auto justification : right
        context.textAlign= 'left'; // fix!!!
        if( justification === 'left' ){
          textX += -textW;
        } else if( justification === 'center' ){
          textX += -halfTextW;
        } // else same as auto
      } else if( halign === 'center' ){ // auto justfication : center
        if( justification === 'left' ){
          textX += -halfTextW;
        } else if( justification === 'right' ){
          textX += halfTextW;
        } // else same as auto
      } else if( halign === 'right' ){ // auto justification : left
        if( justification === 'center' ){
          textX += halfTextW;
        } else if( justification === 'right' ){
          textX += textW;
        } // else same as auto
      }

      switch( valign ){
        case 'top':
          textY -= ( lines.length - 1 ) * lineHeight;
          break;
        case 'center':
        case 'bottom':
          textY -= ( lines.length - 1 ) * lineHeight;
          break;
      }

      for( let l = 0; l < lines.length; l++ ){
        if( lineWidth > 0 ){
          context.strokeText( lines[ l ], textX, textY );
        }

        context.fillText( lines[ l ], textX, textY );

        textY += lineHeight;
      }

    } else {
      if( lineWidth > 0 ){
        context.strokeText( text, textX, textY );
      }

      context.fillText( text, textX, textY );
    }

    if( theta !== 0 ){
      context.rotate( -theta );
      context.translate( -orgTextX, -orgTextY );
    }
  }
};

export default CRp;
